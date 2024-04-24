@inline function fill_order!(
    acc::Account{OData,IData},
    order::Order{OData,IData},
    dt::DateTime,
    fill_price::Price
    ;
    fill_quantity::Quantity=0.0,    # fill quantity, if not provided, order quantity is used (complete fill)
    fees_ccy::Price=0.0,            # fixed fees in account currency
    fees_pct::Price=0.0,            # relative fees as percentage of order value, e.g. 0.001 = 0.1%
)::Execution{OData,IData} where {OData,IData}
    # positions are netted using weighted average price,
    # hence only one static position per instrument is maintained

    pos = @inbounds acc.positions[order.inst.index]
    pos_qty = pos.quantity

    # set fill quantity if not provided
    fill_quantity = fill_quantity > 0 ? fill_quantity : order.quantity
    remaining_quantity = order.quantity - fill_quantity

    # calculate paid fees
    fees_ccy += fees_pct * fill_price * abs(fill_quantity)

    # realized P&L
    realized_quantity = calc_realized_quantity(pos_qty, fill_quantity)
    realized_pnl = 0.0
    if realized_quantity != 0.0
        # order is reducing exposure (covering), calculate realized P&L
        realized_pnl = (fill_price - pos.avg_price) * realized_quantity
        pos.pnl -= realized_pnl
    end
    realized_pnl -= fees_ccy

    # execution sequence number
    seq = eid!(acc)

    # create execution object
    exe = Execution(
        order,
        seq,
        dt,
        fill_price,
        fill_quantity,
        remaining_quantity,
        realized_pnl,
        realized_quantity,
        fees_ccy,
        pos_qty,
        pos.avg_price,
    )

    # calculate new exposure
    new_exposure = pos_qty + fill_quantity
    if new_exposure == 0.0
        # no more exposure
        pos.avg_price = 0.0
    else
        # update average price of position
        if sign(new_exposure) != sign(pos_qty)
            # handle transitions from long to short and vice versa
            pos.avg_price = fill_price
        elseif abs(new_exposure) > abs(pos_qty)
            # exposure is increased, update average price
            pos.avg_price = (pos.avg_price * pos_qty + fill_price * fill_quantity) / new_exposure
        end
        # else: exposure is reduced, no need to update average price
    end

    # update position quantity
    pos.quantity = new_exposure

    # update account balance and equity incl. fees
    acc.balance -= fill_quantity * fill_price + fees_ccy
    acc.equity -= fees_ccy

    # update P&L of position and account equity (w/o fees, already accounted for)
    update_pnl!(acc, pos, fill_price)

    push!(acc.executions, exe)

    exe
end
using PrettyTables
using Printf
using Dates

# --------------- Instrument ---------------

function Base.show(io::IO, inst::Instrument)
    print(io, "[Instrument] " *
              "index=$(inst.index) " *
              "symbol=$(inst.symbol)")
end

# --------------- Order ---------------

function Base.show(io::IO, o::Order{O,I}) where {O,I}
    date_formatter = x -> Dates.format(x, "yyyy-mm-dd HH:MM:SS")
    print(io, "[Order] $(o.symbol) " *
              "dt=$(date_formatter(o.date))" *
              "px=$(format_price(o.inst, o.price)) " *
              "qty=$(format_quantity(o.inst, o.quantity)) ")
end

Base.show(order::Order{O,I}) where {O,I} = Base.show(stdout, order)

# --------------- Trade ---------------

function Base.show(io::IO, t::Trade)
    date_formatter = x -> Dates.format(x, "yyyy-mm-dd HH:MM:SS")
    ccy_formatter = x -> @sprintf("%.2f", x)
    inst = t.order.inst
    print(io, "[Trade] " *
              "dt=$(date_formatter(t.date)) " *
              "fill_px=$(format_price(inst, t.fill_price)) " *
              "fill_qty=$(format_quantity(inst, t.fill_quantity)) " *
              "remain_qty=$(format_quantity(inst, t.remaining_quantity)) " *
              "real_pnl=$(ccy_formatter(t.realized_pnl)) " *
              "real_qty=$(format_quantity(inst, t.realized_quantity)) " *
              "fee_ccy=$(ccy_formatter(t.fee_ccy)) " *
              "pos_px=$(format_price(inst, t.pos_price)) " *
              "pos_qty=$(format_quantity(inst, t.pos_quantity))")
end

Base.show(obj::Trade) = Base.show(stdout, obj)

function print_trades(
    io::IO,
    acc::Account{O,I}
    ;
    max_print=25
) where {O,I}
    trades = acc.trades

    if length(trades) == 0
        print(io, "\n  No trades\n")
        return
    end

    n_total = length(trades)
    n_shown = min(n_total, max_print)
    n_hidden = n_total - n_shown

    cols = [
        Dict(:name => "Seq", :val => t -> t.tid, :fmt => (e, v) -> v),
        Dict(:name => "Symbol", :val => t -> t.order.inst.symbol, :fmt => (e, v) -> v),
        Dict(:name => "Date", :val => t -> "$(format_date(acc, t.order.date)) +$(Dates.value(round(t.date - t.order.date, Millisecond))) ms", :fmt => (e, v) -> v),
        # Dict(:name => "Qty", :val => t -> t.order.quantity, :fmt => (e, v) -> format_quantity(instrument(e), v)),
        Dict(:name => "Fill qty", :val => t -> t.fill_quantity, :fmt => (e, v) -> format_quantity(e.order.inst, v)),
        Dict(:name => "Remain. qty", :val => t -> t.remaining_quantity, :fmt => (e, v) -> format_quantity(e.order.inst, v)),
        Dict(:name => "Fill price", :val => t -> t.fill_price, :fmt => (e, v) -> isnan(v) ? "—" : format_price(e.order.inst, v)),
        Dict(:name => "Realized P&L", :val => t -> t.realized_pnl, :fmt => (e, v) -> isnan(v) ? "—" : format_ccy(acc, v)),
        Dict(:name => "Fee", :val => t -> t.fee_ccy, :fmt => (e, v) -> format_ccy(acc, v))
    ]
    columns = [c[:name] for c in cols]

    data_columns = []
    for col in cols
        push!(data_columns, map(col[:val], first(trades, n_shown)))
    end
    data_matrix = reduce(hcat, data_columns)

    formatter = (v, row_ix, col_ix) -> cols[col_ix][:fmt](trades[row_ix], v)

    h_pnl_pos = Highlighter((data, i, j) -> cols[j][:name] == "Realized P&L" && data_columns[j][i] > 0, foreground=0x11BF11)
    h_pnl_neg = Highlighter((data, i, j) -> cols[j][:name] == "Realized P&L" && data_columns[j][i] < 0, foreground=0xDD0000)
    h_qty_pos = Highlighter((data, i, j) -> cols[j][:name] == "Fill qty" && data_columns[j][i] > 0, foreground=0xDD00DD)
    h_qty_neg = Highlighter((data, i, j) -> cols[j][:name] == "Fill qty" && data_columns[j][i] < 0, foreground=0xDDDD00)

    if n_hidden > 0
        pretty_table(
            io,
            data_matrix
            ;
            header=columns,
            highlighters=(h_pnl_pos, h_pnl_neg, h_qty_pos, h_qty_neg),
            formatters=formatter,
            compact_printing=true)
        println(io, " [...] $n_hidden more trades")
    else
        pretty_table(
            io,
            data_matrix
            ;
            header=columns,
            highlighters=(h_pnl_pos, h_pnl_neg, h_qty_pos, h_qty_neg),
            formatters=formatter,
            compact_printing=true)
    end
end

# --------------- Position ---------------

function print_positions(
    acc::Account{O,I}
    ;
    max_print=50,
    kwargs...
) where {O,I}
    print_positions(
        stdout,
        acc
        ;
        max_print,
        kwargs...
    )
end

function print_positions(
    io::IO,
    acc::Account{O,I}
    ;
    max_print=50
) where {O,I}
    positions = filter(p -> p.quantity != 0, acc.positions)

    if length(positions) == 0
        return
    end

    n_total = length(positions)
    n_shown = min(n_total, max_print)
    n_hidden = n_total - n_shown

    cols = [
        Dict(:name => "Symbol", :val => t -> t.inst.symbol, :fmt => (p, v) -> v),
        Dict(:name => "Qty", :val => t -> t.quantity, :fmt => (p, v) -> format_quantity(p.inst, v)),
        Dict(:name => "Avg. price", :val => t -> t.avg_price, :fmt => (p, v) -> isnan(v) ? "—" : format_price(p.inst, v)),
        Dict(:name => "P&L", :val => t -> t.pnl, :fmt => (p, v) -> isnan(v) ? "—" : format_ccy(acc, v))
    ]
    columns = [c[:name] for c in cols]

    data_columns = []
    for col in cols
        push!(data_columns, map(col[:val], first(positions, n_shown)))
    end
    data_matrix = reduce(hcat, data_columns)

    formatter = (v, row_ix, col_ix) -> cols[col_ix][:fmt](positions[row_ix], v)

    h_pnl_pos = Highlighter((data, i, j) -> cols[j][:name] == "P&L" && data_columns[j][i] > 0, foreground=0x11BF11)
    h_pnl_neg = Highlighter((data, i, j) -> cols[j][:name] == "P&L" && data_columns[j][i] < 0, foreground=0xDD0000)
    h_qty_pos = Highlighter((data, i, j) -> cols[j][:name] == "Qty" && data_columns[j][i] > 0, foreground=0xDD00DD)
    h_qty_neg = Highlighter((data, i, j) -> cols[j][:name] == "Qty" && data_columns[j][i] < 0, foreground=0xDDDD00)

    if n_hidden > 0
        pretty_table(
            io,
            data_matrix
            ;
            header=columns,
            highlighters=(h_pnl_pos, h_pnl_neg, h_qty_pos, h_qty_neg),
            formatters=formatter,
            compact_printing=true)
        println(io, " [...] $n_hidden more positions")
    else
        pretty_table(
            io,
            data_matrix
            ;
            header=columns,
            highlighters=(h_pnl_pos, h_pnl_neg, h_qty_pos, h_qty_neg),
            formatters=formatter,
            compact_printing=true)
    end
end

function Base.show(io::IO, pos::Position)
    print(io, "[Position] $(p.inst.symbol) " *
              "px=$(format_price(p.inst, pos.avg_price)) " *
              "qty=$(format_quantity(p.inst, pos.quantity)) " *
              "pnl=$(format_price(p.inst, pos.pnl))")
end

Base.show(pos::Position) = Base.show(stdout, pos)

# --------------- Account ---------------

function Base.show(
    io::IO,
    acc::Account{O,I}
    ;
    max_orders=50,
    kwargs...
) where {O,I}
    display_width = displaysize(io)[2]

    function get_color(val)
        val >= 0 && return val == 0 ? crayon"#888888" : crayon"#11BF11"
        crayon"#DD0000"
    end

    n_open_pos = count(p -> p.quantity ≉ 0, acc.positions)
    acc_return = total_return(acc)

    title = " ACCOUNT SUMMARY "
    title_line = '━'^(floor(Int64, (display_width - length(title)) / 2))
    println(io, "")
    println(io, title_line * title * title_line)
    print(io, "Balance:         $(format_ccy(acc, acc.balance)) (initial $(format_ccy(acc, acc.initial_balance)))\n")
    # print(io, " (")
    # print(io, get_color(balance_ret(acc)), "$(@sprintf("%+.2f", balance_ret(acc)*100))%", Crayon(reset=true))
    # print(io, ")\n")
    print(io, "Equity:          $(format_ccy(acc, acc.equity))")
    print(io, " (")
    print(io, get_color(acc_return), "$(@sprintf("%+.1f", 100*acc_return))%", Crayon(reset=true))
    print(io, ")\n")
    println(io, "Open positions:  $n_open_pos")
    print_positions(io, acc; kwargs...)
    println(io, "Trades:          $(length(acc.trades))")
    print_trades(io, acc; max_print=max_orders, kwargs...)
    println(io, '━'^display_width)
    print(io, "")
end

Base.show(acc::Account; kwargs...) = Base.show(stdout, acc; kwargs...)

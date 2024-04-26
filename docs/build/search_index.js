var documenterSearchIndex = {"docs":
[{"location":"examples/1_random_trading.html#Random-trading-strategy-example","page":"1. Random Trading","title":"Random trading strategy example","text":"","category":"section"},{"location":"examples/1_random_trading.html","page":"1. Random Trading","title":"1. Random Trading","text":"This dummy example demonstrates how to backtest a simple random trading strategy using synthetic data generated in the script. The price series is a random walk with a drift of 0.1 and initial price 1000.","category":"page"},{"location":"examples/1_random_trading.html","page":"1. Random Trading","title":"1. Random Trading","text":"The strategy randomly buys or sells an instrument with a probability of 1%. Buy and sell orders use the same price series, implying a spread of 0. Each trade is executed at a fee of 0.1%. For the sake of illustration, only 75% of the order quantity is filled.","category":"page"},{"location":"examples/1_random_trading.html","page":"1. Random Trading","title":"1. Random Trading","text":"The account equity and drawdowns are collected for every hour and plotted at the end using UnicodePlots.","category":"page"},{"location":"examples/1_random_trading.html#Code","page":"1. Random Trading","title":"Code","text":"","category":"section"},{"location":"examples/1_random_trading.html","page":"1. Random Trading","title":"1. Random Trading","text":"using Fastback\nusing Dates\nusing Random\n\n# set RNG seed for reproducibility\nRandom.seed!(42);\n\n# generate synthetic price series\nN = 2_000;\nprices = 1000.0 .+ cumsum(randn(N) .+ 0.1);\ndts = map(x -> DateTime(2020, 1, 1) + Hour(x), 0:N);\n\n# define instrument\nDUMMY = Instrument(1, Symbol(\"DUMMY\"));\ninstruments = [DUMMY];\n\n# create trading account with 10,000 start capital\nacc = Account{Nothing}(instruments, 10_000.0);\n\n# data collector for account equity and drawdowns (sampling every hour)\ncollect_equity, equity_data = periodic_collector(Float64, Hour(1));\ncollect_drawdown, drawdown_data = drawdown_collector(DrawdownMode.Percentage, Hour(1));\n\n# loop over price series\nfor (dt, price) in zip(dts, prices)\n    # randomly trade with 1% probability\n    if rand() < 0.01\n        quantity = rand() > 0.4 ? 1.0 : -1.0\n        order = Order(oid!(acc), DUMMY, dt, price, quantity)\n        fill_order!(acc, order, dt, price; fill_quantity=0.75order.quantity, fee_pct=0.001)\n    end\n\n    # update position and account P&L\n    update_pnl!(acc, DUMMY, price)\n\n    # collect data for plotting\n    collect_equity(dt, acc.equity)\n    collect_drawdown(dt, acc.equity)\nend\n\n# print account statistics\nshow(acc)\n\n\n# plot equity and drawdown\nusing UnicodePlots, Term\n\ngridplot([\n        lineplot(\n            dates(equity_data), values(equity_data);\n            title=\"Account equity\",\n            height=12\n        ),\n        lineplot(\n            dates(drawdown_data), 100values(drawdown_data);\n            title=\"Drawdowns [%]\",\n            color=:red,\n            height=12\n        )\n    ]; layout=(1, 2))","category":"page"},{"location":"examples/1_random_trading.html#Output","page":"1. Random Trading","title":"Output","text":"","category":"section"},{"location":"examples/1_random_trading.html","page":"1. Random Trading","title":"1. Random Trading","text":"(Image: Backtest Account Summary)","category":"page"},{"location":"examples/1_random_trading.html","page":"1. Random Trading","title":"1. Random Trading","text":"(Image: Backtest Plots)","category":"page"},{"location":"examples/2_portfolio_trading.html#Portfolio-trading-strategy-example","page":"2. Portfolio Trading","title":"Portfolio trading strategy example","text":"","category":"section"},{"location":"examples/2_portfolio_trading.html","page":"2. Portfolio Trading","title":"2. Portfolio Trading","text":"This example demonstrates how to run a backtest with multiple assets, i.e. trading a portfolio of assets.","category":"page"},{"location":"examples/2_portfolio_trading.html","page":"2. Portfolio Trading","title":"2. Portfolio Trading","text":"The price data is loaded from a CSV file containing daily close prices for the stocks AAPL, NVDA, TSLA, and GE, ranging from 2022-01-03 to 2024-04-22.","category":"page"},{"location":"examples/2_portfolio_trading.html","page":"2. Portfolio Trading","title":"2. Portfolio Trading","text":"The strategy buys one stock if the last 5 days were positive, and sells it again if the last 2 days were negative. Each trade is executed at a fee of 0.1%.","category":"page"},{"location":"examples/2_portfolio_trading.html","page":"2. Portfolio Trading","title":"2. Portfolio Trading","text":"When missing data points are detected for a stock, all open positions for that stock are closed. Logic of this type is common in real-world strategies and harder to implement in a vectorized way, showcasing the flexibility of Fastback.","category":"page"},{"location":"examples/2_portfolio_trading.html","page":"2. Portfolio Trading","title":"2. Portfolio Trading","text":"The account equity, balance and drawdowns are collected for every day and plotted at the end using the Plots package. Additionally, the performance and P&L breakdown of each stock is plotted and statistics (avg. P&L, min. P&L, max. P&L, win rate) are printed.","category":"page"},{"location":"examples/2_portfolio_trading.html#Code","page":"2. Portfolio Trading","title":"Code","text":"","category":"section"},{"location":"examples/2_portfolio_trading.html","page":"2. Portfolio Trading","title":"2. Portfolio Trading","text":"using Fastback\nusing Dates\nusing CSV\nusing DataFrames\n\n# load CSV daily stock data for symbols AAPL, NVDA, TSLA, GE\ndf_csv = DataFrame(CSV.File(\"examples/data/stocks_1d.csv\"; dateformat=\"yyyy-mm-dd HH:MM:SS\"));\ndf_csv.symbol = Symbol.(df_csv.symbol); # convert string to symbol type\ndf = unstack(df_csv, :dt_close, :symbol, :close) # pivot long to wide format\nsymbols = Symbol.(names(df)[2:end]);\n\n# print summary\ndescribe(df)\n\n# define instrument objects for all symbols\ninstruments = map(t -> Instrument(t[1], t[2]), enumerate(symbols))\n\n# create trading account with 100,000 start capital\nacc = Account{Nothing}(instruments, 100_000.0);\n\n# data collector for account balance, equity and drawdowns (sampling every day)\ncollect_balance, balance_data = periodic_collector(Float64, Day(1));\ncollect_equity, equity_data = periodic_collector(Float64, Day(1));\ncollect_drawdown, drawdown_data = drawdown_collector(DrawdownMode.Percentage, Day(1));\n\nfunction open_position!(acc, inst, dt, price)\n    # invest 20% of equity in the position\n    qty = 0.2acc.equity / price\n    order = Order(oid!(acc), inst, dt, price, qty)\n    fill_order!(acc, order, dt, price; fee_pct=0.001)\nend\n\nfunction close_position!(acc, inst, dt, price)\n    # close position for instrument, if any\n    pos = get_position(acc, inst)\n    has_exposure(pos) || return\n    order = Order(oid!(acc), inst, dt, price, -pos.quantity)\n    fill_order!(acc, order, dt, price; fee_pct=0.001)\nend\n\n# loop over each row of DataFrame\nfor i in 6:nrow(df)\n    row = df[i, :]\n    dt = row.dt_close\n\n    # loop over all instruments and check strategy rules\n    for inst in instruments\n        price = row[inst.symbol]\n\n        window_open = @view df[i-5:i, inst.symbol]\n        window_close = @view df[i-2:i, inst.symbol]\n\n        # close position of instrument if missing data\n        if any(ismissing.(window_open))\n            close_price = get_position(acc, inst).avg_price\n            close_position!(acc, inst, dt, close_price)\n            continue\n        end\n\n        if !is_exposed_to(acc, inst)\n            # buy if last 5 days were positive\n            all(diff(window_open) .> 0) && open_position!(acc, inst, dt, price)\n        else\n            # close position if last 2 days were negative\n            all(diff(window_close) .< 0) && close_position!(acc, inst, dt, price)\n        end\n\n        # update position and account P&L\n        update_pnl!(acc, inst, price)\n    end\n\n    # close all positions at the end of backtest\n    if i == nrow(df)\n        for inst in instruments\n            price = row[inst.symbol]\n            close_position!(acc, inst, dt, price)\n        end\n    end\n\n    # collect data for plotting\n    collect_balance(dt, acc.balance)\n    collect_equity(dt, acc.equity)\n    collect_drawdown(dt, acc.equity)\nend\n\n# print account statistics\nshow(acc)\n\n\n# plots\nusing Plots, Query, Printf, Measures\n\ntheme(:juno;\n    titlelocation=:left,\n    titlefontsize=10,\n    widen=false,\n    fg_legend=:false)\n\n# cash_ratio = values(equity_data) ./ (values(balance_data) .+ values(equity_data))\n\n# equity / balance\np1 = plot(\n    dates(balance_data), values(balance_data);\n    title=\"Account\",\n    label=\"Balance\",\n    linetype=:steppost,\n    yformatter=:plain,\n    color=\"#0088DD\");\nplot!(p1,\n    dates(equity_data), values(equity_data);\n    label=\"Equity\",\n    linetype=:steppost,\n    color=\"#BBBB00\");\n\n# drawdowns\np2 = plot(\n    dates(drawdown_data), 100values(drawdown_data);\n    title=\"Drawdowns [%]\",\n    legend=false,\n    color=\"#BB0000\",\n    yformatter=y -> @sprintf(\"%.1f%%\", y),\n    linetype=:steppost,\n    fill=(0, \"#BB000033\"));\n\n# stocks performance\np3 = plot(\n    df.dt_close, df[!, 2] ./ df[1, 2];\n    title=\"Stocks performance (normalized)\",\n    yformatter=y -> @sprintf(\"%.1f\", y),\n    label=names(df)[2],\n    linetype=:steppost,\n    color=:green);\nfor i in 3:ncol(df)\n    plot!(p3,\n        df.dt_close, df[!, i] ./ df[1, i];\n        label=names(df)[i])\nend\n\n# P&L breakdown by stocks\npnl_by_inst = acc.trades |>\n              @groupby(_.order.inst.symbol) |>\n              @map({\n                  symbol = key(_),\n                  pnl = sum(getfield.(_, :realized_pnl))\n              }) |> DataFrame\np4 = bar(string.(pnl_by_inst.symbol), pnl_by_inst.pnl;\n    legend=false,\n    title=\"P&L breakdown\",\n    permute=(:x, :y),\n    xlims=(0, size(pnl_by_inst)[1]),\n    yformatter=y -> format_ccy(acc, y),\n    color=\"#BBBB00\",\n    linecolor=nothing,\n    bar_width=0.5)\n\nplot(p1, p2, p3, p4;\n    layout=@layout[a{0.4h}; b{0.15h}; c{0.3h}; d{0.15h}],\n    size=(600, 900), margin=0mm, left_margin=5mm)\n\n# statistics per stock\ntrade_stats = acc.trades |>\n              @groupby(_.order.inst.symbol) |>\n              @map({\n                  symbol = key(_),\n                  avg_pnl = sum(getfield.(_, :realized_pnl)) / length(_),\n                  min_pnl = minimum(getfield.(_, :realized_pnl)),\n                  max_pnl = maximum(getfield.(_, :realized_pnl)),\n                  win_rate = count(getfield.(_, :realized_pnl) .> 0) / count(is_realizing.(_)),\n              }) |> DataFrame","category":"page"},{"location":"examples/2_portfolio_trading.html#Output","page":"2. Portfolio Trading","title":"Output","text":"","category":"section"},{"location":"examples/2_portfolio_trading.html","page":"2. Portfolio Trading","title":"2. Portfolio Trading","text":"(Image: Backtest Plots)","category":"page"},{"location":"index.html#Fastback.jl-Blazing-fast-Julia-backtester","page":"Home","title":"Fastback.jl - Blazing fast Julia backtester 🚀","text":"","category":"section"},{"location":"index.html","page":"Home","title":"Home","text":"Fastback provides a lightweight, flexible and highly efficient event-based backtesting library for quantitative trading strategies.","category":"page"},{"location":"index.html","page":"Home","title":"Home","text":"The main value of Fastback is provided by the account and bookkeeping implementation. It keeps track of the open positions, account balance and equity. Furthermore, the execution logic supports fees, slippage, partial fills and execution delays in its design.","category":"page"},{"location":"index.html","page":"Home","title":"Home","text":"Fastback does not try to model every aspect of a trading system, e.g. brokers, data sources, logging etc. Instead, it provides basic building blocks for creating a custom backtesting environment that is easy to understand and extend. For example, Fastback has no notion of \"strategy\" or \"indicator\", such constructs are highly strategy specific, and therefore up to the user to define.","category":"page"},{"location":"index.html","page":"Home","title":"Home","text":"The event-based architecture aims to mimic the way a real-world trading systems works, where new data is ingested as a continuous data stream, i.e. events. This reduces the implementation gap from backtesting to real-world execution significantly compared to a vectorized backtesting frameworks.","category":"page"},{"location":"index.html#Features","page":"Home","title":"Features","text":"","category":"section"},{"location":"index.html","page":"Home","title":"Home","text":"Event-based\nModular architecture, no opinionated black-box design\nSupports arbitrary pricing data source\nSupports modelling fees, execution delays, price slippage and partial fills\nFlexible data collectors to collect time series like account equitity history, number of open positions, etc.\nFacilities for parallelized backtesting and hyperparameter optimization\nUses position netting approach for bookkeeping\nMaintains single position per instrument using weighted average cost method","category":"page"},{"location":"index.html#Bug-reports-and-feature-requests","page":"Home","title":"Bug reports and feature requests","text":"","category":"section"},{"location":"index.html","page":"Home","title":"Home","text":"Please report any issues via the GitHub issue tracker.","category":"page"},{"location":"examples/0_setup.html#Fastback-basic-backtest-setup","page":"Basic Setup","title":"Fastback basic backtest setup","text":"","category":"section"},{"location":"examples/0_setup.html","page":"Basic Setup","title":"Basic Setup","text":"A backtest using Fastback usually consists of the following parts:","category":"page"},{"location":"examples/0_setup.html","page":"Basic Setup","title":"Basic Setup","text":"Data: The data you want to backtest on. This can be a DataFrame, a CSV file, or a database. Ideally, it can be looped over efficiently.\nInstruments: The instruments you want to trade with, e.g. stocks or cryptocurrencies.\nAccount: The account you want to backtest with. This includes the initial capital and all instruments. Positions, trades and general bookkeeping is done here.\nData collectors: Initialize collectors for account balance, equity, drawdowns, etc. These optional data collectors can be used to analyze the backtest results.\nTrading logic: The trading strategy you want to backtest. It is called at every iteration of the input data and takes trading decisions like buying or selling stocks.\nAnalysis: Analyze the backtest results, e.g. the account balance, equity, drawdowns, etc. by e.g. printing to console or displaying plots. Alternatively, store the results in a Vector or DataFrame for further analysis, i.e. when running an optimization to find the best strategy parameters.","category":"page"}]
}

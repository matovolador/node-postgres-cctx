const ccxt = require ('ccxt');
const axios = require('axios').default;
const DB = require('./db.js');
const cron = require('node-cron');

require('dotenv').config()

runCron = true
runMain = false
queryDB = false

const myArgs = process.argv.slice(2);
console.log('myArgs: ', myArgs);
for (var i=0;i<myArgs.length;i++){
    switch (myArgs[i]) {
        case 'no-cron':
          console.log(myArgs[1], 'no-cron');
          runCron = false
          break;
        case 'main':
          console.log(myArgs[1], 'main.');
          runMain = true
          break;
        case 'query':
            console.log(myArgs[1], 'query.');
            queryDB = true
            break;
        default:
          console.log('Invalid arg found. Exiting program');
          process.exit()
      }
}

if (runCron){
    cron.schedule('*/10 * * * *', () => {
    console.log('running a task every 10 minutes');
    (async() => { 
        await main()
    })()
 });
}



async function main(){
    let db = new DB();
    // pools will use environment variables
    // for connection information
    
    var verbose = false
    var sandbox = false
    if (process.env.VERBOSE === "true" || process.env.VERBOSE === "1"){
        verbose = true
    }
    if (process.env.TESTNET === "true" || process.env.TESTNET === "1"){
        sandbox = true
    }
    let binance    = new ccxt.binance ({
        apiKey : process.env.API_KEY,
        secret: process.env.API_SECRET,
        enableRateLimit: true,
        options: {
            defaultType: 'future'
        }
    })
    binance.setSandboxMode(sandbox)
    binance.verbose = verbose;
    var markets = await binance.fetchMarkets()

    // Swap to dual mode if necessary to create SHORT or LONG orders.
    //await binance.fapiPrivatePostPositionSideDual({'dualSidePosition':'true'})

    // Create orders for testing
    // await binance.createOrder(symbol="BTCUSDT",type='TAKE_PROFIT',side='BUY',amount=5.2,price=545.4,params={"positionSide":"LONG",stopPrice:560})
    // await binance.createOrder(symbol="BTCUSDT",type='TAKE_PROFIT',side='BUY',amount=5.2,price=545.4,params={"positionSide":"SHORT",stopPrice:560})
    //await binance.createOrder(symbol="BTCUSDT",type='STOP_MARKET',side='SELL',amount=0.5,price=5000,params={"positionSide":"LONG",stopPrice:4500})
    //await binance.createOrder(symbol="BTCUSDT",type='STOP_MARKET',side='SELL',amount=0.3,price=5000,params={"positionSide":"SHORT",stopPrice:4500})

    var exit_order_status_clause = 'filled'

    console.log(markets.length)
    for (var i=0;i<markets.length;i++){
        // console.log(await binance.fetchClosedOrders(markets[i].id))
        // console.log(markets[i])
        // return
        //console.log(markets[i])
        console.log(markets[i].id)
        console.log(markets[i].symbol);


        var last_order_id = await db.get_last_order_id(markets[i].symbol)
        var orders = []
        if (!last_order_id){
            orders = await binance.fetchOrders(markets[i].symbol)
        }else{
            orders = await binance.fetchOrders(markets[i].symbol,params={"orderId":parseInt(last_order_id)})
        }

        // retrieve all non filled orders to check if their status have changed
        var db_orders = await db.get_orders(symbol=markets[i].symbol)
        for (var m =0; m< db_orders.length;m++){
            // check if order is already in initial array
            var order_found_in_initial_array = false
            for (var h=0; h<orders.length;h++){
                if (orders[h].id == db_orders[m].id){
                    // order is already inside the orders array. no need to append it
                    order_found_in_initial_array = true
                }
            }
            if ((db_orders[m].status !== exit_order_status_clause) && !order_found_in_initial_array){
                order = await binance.fetchOrder(id=db_orders[m].id,symbol=markets[i].symbol)
                // append to array if status has changed
                if (order.info.status !== db_orders[m].status) orders.push(order)
            }
        }

        
        console.log(orders)
        // Get last order id from database to see if we have new ones to check
        
        var data_to_send = []
        var request_error = false
        for (h=0;h<orders.length;h++){
            var signal = false
            var entry_or_exit = false
            if (orders[h].info.positionSide === 'LONG' && orders[h].info.status !== exit_order_status_clause){
                console.log(orders[h].id + " is Entry Long" )
                entry_or_exit = "entry"
                signal = process.env.SIGNAL_ENTRY_LONG
            }else if (orders[h].info.positionSide === 'LONG' && orders[h].info.status === exit_order_status_clause){
                console.log(orders[h].id + " is Exit Long" )
                entry_or_exit = "exit"
                signal = process.env.SIGNAL_EXIT_LONG
            }else if (orders[h].info.positionSide === 'SHORT' && orders[h].info.status !== exit_order_status_clause){
                console.log(orders[h].id + " is Entry Short" )
                entry_or_exit = "entry"
                signal = process.env.SIGNAL_ENTRY_SHORT
            }else if (orders[h].info.positionSide === 'SHORT' && orders[h].info.status === exit_order_status_clause){
                console.log(orders[h].id + " is Exit Short" )
                entry_or_exit = "exit"
                signal = process.env.SIGNAL_EXIT_SHORT
            }
            var order = await db.get_orders(markets[i].symbol,orders[h].id);
            var order_created = false
            var order_status_update = false
            console.log(order)
            if (!order.length){
                await db.create_order(markets[i].symbol,orders[h].id,orders[h].info.status,orders[h].info.positionSide)
                order_created = true
                order = await db.get_orders(markets[i].symbol,orders[h].id);
                data_to_send.push({
                    "id": orders[h].id,
                    "symbol": markets[i].symbol,
                    "status": orders[h].info.status,
                    "positionSide": orders[h].info.positionSide,
                    "movement": entry_or_exit

                })
            }else{
                if (order.status !== orders[h].info.status){
                    await db.update_order_status(orders[h].id,orders[h].info.status,markets[i].symbol)
                    if (orders[h].info.status === exit_order_status_clause) {
                        order_status_update = true
                        data_to_send.push({
                            "id": orders[h].id,
                            "symbol": markets[i].symbol,
                            "status": orders[h].info.status,
                            "positionSide": orders[h].info.positionSide,
                            "movement": entry_or_exit
        
                        })
                    }
                }
            }
            
            if ((order_created || order_status_update) && signal){
                // SEND WEBHOOK
                axios.post('https://<your-webhook-url>',{
                    code: signal
                })
                  .then(function (response) {
                    // handle success
                    console.log(response);
                  })
                  .catch(function (error) {
                    // handle error
                    console.log(error);
                    request_error = true
                  })
                  .then(function () {
                    // always executed
                  });
            }
            if (request_error){
                await db.cleanup_orders_table(markets[i].symbol,orders[h].id)
                break
            }
        }
        if (!request_error) {
            await db.cleanup_orders_table(markets[i].symbol)
            if (queryDB){
                console.log(await db.get_orders(markets[i].symbol))
            }
        }
        else {
            if (queryDB){
                console.log(await db.get_orders(markets[i].symbol))
            }
            break
        }

    }
}

if (runMain){ (async() => { 
    await main()
})()}


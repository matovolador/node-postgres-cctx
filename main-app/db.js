const { Pool, Client } = require('pg')
require('dotenv').config()
class DB {
    constructor(){}

    async get_client(){
        let client = new Client({
            connectionString:process.env.DATABASE_URL,
            idleTimeoutMillis: 0,
            connectionTimeoutMillis: 0,
            logging: log => console.log('logging:', log)
        })
        await client.connect()
        return client
    }

    async create_order(symbol,order_id,order_status,position_side){
        let client = await this.get_client()
        await client.query("BEGIN")
        await client.query("INSERT INTO orders (id,status,position_side,symbol) VALUES ($1,$2,$3,$4) ON CONFLICT (id,symbol) DO UPDATE SET status=$5, position_side=$6",[order_id,order_status,position_side,symbol,order_status,position_side])
        await client.query("COMMIT")
        await client.end()
    }
    
    async get_orders(symbol,order_id=false){
        let client = await this.get_client()
        if (!order_id){
            var orders = await client.query("SELECT * FROM orders WHERE symbol=$1 ORDER BY id DESC",[symbol])
            await client.end()
            return orders.rows
        }else{
            var order = await client.query("SELECT * FROM orders WHERE symbol=$1 AND id=$2",[symbol,order_id])
            await client.end()
            return order.rows
        }
    }
    async update_order_status(order_id,order_status,symbol){
        let client = await this.get_client()
        await client.query("BEGIN")
        await client.query("UPDATE orders SET status=$1 WHERE id=$2 AND symbol=$3",[order_status,order_id,symbol])
        await client.query("COMMIT")
        await client.end()
    }
    async get_last_order_id(symbol){
        let client = await this.get_client()
        var order = await client.query("SELECT * FROM orders WHERE symbol=$1 ORDER BY id DESC LIMIT 1",[symbol])
        await client.end()
        if (order.rows && order.rows.length>0) return order.rows[0].id
        return false
    }

    // this will remove all orders that not 'open', since the webhook was sent at their finalized state, and keep the last order id even if its not 'open' status
    async cleanup_orders_table(symbol,order_id=false) {
        let client = await this.get_client()
        var last_order_id = false
        if (!order_id) await this.get_last_order_id(symbol)
        else last_order_id = order_id
        await client.query("BEGIN")
        await client.query("DELETE FROM orders WHERE status not in ('open','NEW','OPEN','new') and id!=$1 and symbol=$2",[last_order_id,symbol])
        await client.query("COMMIT")
        await client.end()
    }
}
module.exports = DB
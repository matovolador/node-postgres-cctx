# README

## How the code works
This is a node script. All the node code is inside `main-app` folder. This folder structure is made like this in order to suit docker-compose structures.

The main code is inside `main-app/index.js` and its ran with npm run. There are 2 execution types ( go inside main-app folder and do):
* `npm run start` - This will execute a one time script for testing purposes or on-demand. Basically for testing and dev purposes.
* `npm run cron` - This will trigger the npm cron code that will automatically trigger the code's main function every 10 minutes.

The database is a docker image of postgresql. Its managed by the db.js' DB class, and `node-pg-migrate` package for migrations and managing the database design and updates with code instead of manually. This makes updates to the table structures automatically after running `npm run migrate up`, which is ran automatically by the docker-compose file, meaning, migrations and database design code will execute automatically on deployment.

Cronjob within the node image (main code container) is done with `node-cron` package. This means we can do cronjobs inside the script itself, instead of having to configure a linux machine and setup the cron tasks.

## Code logic

Either with cronjob, or single execution, the code does as follows:
1) Connects to Binance Futures API. Credentials must be placed inside `main-app/.env` file. API_KEY and API_SECRET. (You can test it on the testnet by setting TESTNET="1" in the same (and only) .env file).
2) Loops through all different markets. On each market it will check for orders from binance. If there is already stored id in the database, it will get orders from that id onwards. By default, if no id is specified, it will get recent orders. "Get recent orders" would be the starting point of the scenario since we dont have any data yet.
3) We then get orders that we stored in the database, and check if any of those have a status different than 'filled', which is a final status, the Exit one. So for those that arent 'filled', we fetch them individually from the binance API in case we didnt retrieve them in our initial API request. If their status changed, we add them to the "orders array". we are creating an "orders array" per market symbol.
4) We loop through the orders array and find their positionSide and their status. positionSide will be either SHORT or LONG. For status we are checking that it is 'filled' or otherwise. 'filled' means Exit. not 'filled' means Entry. We store this info inside an array of data (in RAM, its temporary) that we will be sending to the webhook as signals.
5) We check that the current order status changed from the last time we stored it in the database. If it did , we will update the information in the database and add the object to send it to the webhook. The other case is that the order does not exist in the database, in which case we will also be sending it to the webhook.
6) After sending the webhooks for all orders that either of those 2 conditions are true, we cleanup the database, deleting 'filled' orders, but always keeping the last order id, for the next search. The reason we delete these orders is because their storage purpose has been finalized since the webhook was sent, and they are not 'open' or 'new' so we dont need to check again for their status in the binance API, and this way we are preventing a massive uncontrollable database size.

## Environment variables

`main-app/.env` must contain the following variables:
* API_KEY="YOUR_API_KEY"
* API_SECRET="YOUR_API_SECRET"
* TESTNET="0"
* VERBOSE="0"
* DATABASE_URL="postgresql://postgres:secret@0.0.0.0:5432/project"
* ENTRY_SIGNAL=""
* EXIT_SIGNAL=""

Set TESTNET="1" if you wish to run the code in Binance Test Network.

Set VERBOSE="1" if you wish to debug all of the binance api calls.

DATABASE_URL should not be changed since this connects to the docker db image, and it is not exposed to the outside. So the password and all the information only matter to the nodejs files. There is no security risk here, again, the database is not exposed to the outside, only to the main-app code.
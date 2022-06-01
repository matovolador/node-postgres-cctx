/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumns('orders', {
        symbol: { type: 'VARCHAR(10)', notNull: true },
      })
};

exports.down = pgm => {
    pgm.dropColumns('orders', {symbol})
};

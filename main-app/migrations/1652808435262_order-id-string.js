/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.alterColumn('orders','id',{type: 'VARCHAR(2500)', notNull: true})
};

exports.down = pgm => {
    pgm.alterColumn('orders','id',{type: 'integer', notNull: true})
};

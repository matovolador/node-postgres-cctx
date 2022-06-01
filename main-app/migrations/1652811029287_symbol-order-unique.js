/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addConstraint("orders","unique_symbol_id","UNIQUE (id, symbol)")
};

exports.down = pgm => {
    pgm.dropConstraint("orders","unique_symbol_id")
};

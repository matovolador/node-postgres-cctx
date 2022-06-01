/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.createTable('orders', {
        id: {type: 'integer', notNull: true},
        status: { type: 'varchar(20)', notNull: true },
        position_side: { type: 'varchar(100)', notNull: true}
        // createdAt: {
        //   type: 'timestamp',
        //   notNull: true,
        //   default: pgm.func('current_timestamp'),
        // },
      })
};

exports.down = pgm => {
    pgm.dropTable('orders')
};

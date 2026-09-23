// One price list, shared by every payment provider.
//
// It physically lives in api/paypal/_lib.js and is re-exported here under a
// provider neutral name. That indirection is deliberate: the PayPal path is the
// one currently taking real money, and it is not being edited to add a second
// provider. Adding a rail must not risk the rail that works.
//
// If PayPal is ever retired, move the OFFERS object into this file and flip the
// import direction. Nothing else has to change.
export { OFFERS, CURRENCY } from '../paypal/_lib.js';

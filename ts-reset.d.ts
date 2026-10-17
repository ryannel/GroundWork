// Built-ins that return any return unknown instead, so the value is checked before it is used.
// (set-has, map-has and array-includes are left out: they loosen types rather than tighten them.)
import '@total-typescript/ts-reset/json-parse';
import '@total-typescript/ts-reset/fetch';
import '@total-typescript/ts-reset/is-array';
import '@total-typescript/ts-reset/storage';
import '@total-typescript/ts-reset/filter-boolean';
import '@total-typescript/ts-reset/map-constructor';
import '@total-typescript/ts-reset/promise-catch';

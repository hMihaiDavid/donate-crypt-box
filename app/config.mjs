import assert from 'assert';
import _ from 'lodash';

export const DEFAULT_LEASE_MAX_AGE_SECS = 60 * 60 * 24 * 7 * 1;
export const DEFAULT_LEASE_SET_SIZE = 5;
export const DEFAULT_GIVE_FULL_LEASE_SET = false;

const leaseMaxAgeSecs = Number(process.env.LEASE_MAX_AGE_SECS) || DEFAULT_LEASE_MAX_AGE_SECS;
assert(_.isInteger(leaseMaxAgeSecs) && leaseMaxAgeSecs >= 0, "LEASE_MAX_AGE_SECS must be a positive integer or 0.");

const leaseSetSize = Number(process.env.LEASE_SET_SIZE) || DEFAULT_LEASE_SET_SIZE;
assert(_.isInteger(leaseSetSize) && leaseSetSize > 0, "LEASE_SET_SIZE must be a positive integer.")

let giveFullLeaseSet = process.env.GIVE_FULL_LEASE_SET;
giveFullLeaseSet = giveFullLeaseSet !== undefined ? Boolean(giveFullLeaseSet) : DEFAULT_GIVE_FULL_LEASE_SET;

export const LEASE_MAX_AGE_SECS = leaseMaxAgeSecs;
export const LEASE_SET_SIZE = leaseSetSize;
export const GIVE_FULL_LEASE_SET = giveFullLeaseSet;
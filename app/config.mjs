import assert from 'assert';
import _ from 'lodash';

export const DEFAULT_LEASE_MAX_AGE_SECS = 60 * 60 * 24 * 7 * 1;
export const DEFAULT_LEASE_SET_SIZE = 5;
export const DEFAULT_NUM_GIVEN_ADDRESSES = 1;

const leaseMaxAgeSecs = process.env.LEASE_MAX_AGE_SECS || DEFAULT_LEASE_MAX_AGE_SECS;
assert(_.isInteger(leaseMaxAgeSecs) && leaseMaxAgeSecs >= 0, "LEASE_MAX_AGE_SECS must be a positive integer or 0.");

const leaseSetSize = process.env.LEASE_SET_SIZE || DEFAULT_LEASE_SET_SIZE;
assert(_.isInteger(leaseSetSize) && leaseSetSize > 0, "LEASE_SET_SIZE must be a positive integer.")

const numGivenAddresses = process.env.NUM_GIVEN_ADDRESSES || DEFAULT_NUM_GIVEN_ADDRESSES;
assert(_.isInteger(numGivenAddresses) && numGivenAddresses > 0, "NUM_GIVEN_ADDRESSES must be a positive integer.")
assert(numGivenAddresses <= leaseSetSize, "NUM_GIVEN_ADDRESSES must be <= LEASE_SET_SIZE");

export const LEASE_MAX_AGE_SECS = leaseMaxAgeSecs;
export const LEASE_SET_SIZE = leaseSetSize;
export const NUM_GIVEN_ADDRESSES = numGivenAddresses;
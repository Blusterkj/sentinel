/*
#[test_only]
module sentinel::sentinel_tests;
// uncomment this line to import the module
// use sentinel::sentinel;

#[error(code = 0)]
const ENotImplemented: vector<u8> = b"Not Implemented";

#[test]
fun test_sentinel() {
    // pass
}

#[test, expected_failure(abort_code = ::sentinel::sentinel_tests::ENotImplemented)]
fun test_sentinel_fail() {
    abort ENotImplemented
}
*/

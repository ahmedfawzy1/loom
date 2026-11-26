// How alike a query and a title must be to match fuzzily (pg_trgm word similarity, 0–1). Measured:
// one transposed letter scores 0.33–0.5, unrelated titles 0.17 or less
export const SEARCH_FUZZY_THRESHOLD = 0.3;

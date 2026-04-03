# Curiosity Report: Fuzz Testing with `fast-check`

## What is fuzz testing?

Fuzz testing (or fuzzing) is a technique where you feed a program large amounts of randomly-generated input to discover unexpected behavior, crashes, or bugs. It originated in OS/network security research in the late 80s/early 90s (Barton Miller's 1990 Unix fuzz study being notable), but modern property-based testing tools like `fast-check` bring the same idea to unit-level JavaScript code.

The key distinctions from traditional unit testing:

| Traditional Unit Test | Property-Based Fuzz Test |
|---|---|
| You write specific input values | You define a generator that produces values |
| Tests one or a few scenarios | Runs hundreds or thousands of generated scenarios |
| Finds bugs you thought to test for | Finds bugs you didn't know to look for |
| Fails deterministically | Fails non-deterministically (but is reproducible via seed) |

The core insight is: instead of asserting `expect(add(2, 3)).toBe(5)`, you assert a property that should hold for all inputs, like `add(a, b) === add(b, a)` (commutativity). Then `fast-check` generates thousands of `(a, b)` pairs to try to disprove it.

---

## How `fast-check` works internally

### Arbitraries (input generators)

The foundation of `fast-check` is the `Arbitrary<T>` abstraction — an object that knows how to:
1. Generate a random value of type `T`
2. Shrink a failing value toward a simpler one

Built-in arbitraries include `fc.integer()`, `fc.string()`, `fc.array()`, `fc.record()`, and many more. They can be composed, and this would produce an array of objects: `fc.array(fc.record({ price: fc.integer(), qty: fc.integer() }))`

Under the hood, each arbitrary uses a `Random` object seeded with a deterministic integer. This is crucial, as every failing test can be reproduced exactly by re-running with the same seed. Without the known seed value, the tests would not be reproducible. 

### The shrinking algorithm

When `fast-check` finds a failing input, it reports it and it tries to find the simplest input that still triggers the failure (hence being called "shrinking").

The algorithm works roughly like this:

```sh
initial_failing_input = [complex, messy, large value]

loop:
  candidates = arbitrary.shrink(current_failing_input)
  for each candidate:
    if property(candidate) still fails:
      current_failing_input = candidate  // smaller!
      break
  if no candidate fails:
    done with the likelyhood of current_failing_input being minimal
```

Each property is shrunk differently, but all adhere to the same principle. For integers, shrinking moves toward `0`. For strings, it shortens them and moves characters toward `'a'`. For arrays, it reduces length and then shrinks elements. For records, it shrinks each field independently.

The result is transformative for debugging. Instead of getting a counterexample like:

```json
[{"price": 98.60, "quantity": 137, "discount": 0.05}, {"price": 50.49, "quantity": 3, ...}, ...]
```

...after 11 rounds of shrinking you get:

```json
[{"price": 0.01, "quantity": 100, "discount": 0.01}, {"price": 0.01, "quantity": 1, "discount": undefined}]
```

That second example immediately points you at the exact boundary condition: `quantity > 99` AND `discount` present.

### 3. The test runner

`fc.assert(fc.property(...))` runs the property `numRuns` times (default 100, configurable up to whatever you need). If any run fails, it triggers the shrink loop. The final counterexample and the seed are both reported, so failures are fully reproducible:

```
Property failed after 4 tests
{ seed: 1751639619, path: "3:2:1:3:4:1:3:2:2:2:2:2", endOnFailure: true }
Counterexample: [...]
Shrunk 11 time(s)
```

You can re-run with `fc.assert(..., { seed: 1751639619 })` to replay the exact same failure.

---

## Experiments

I set up a [Node.js project](https://github.com/opensprocket/CS329-curiosityReport) and ran 4 suites of experiments using `fast-check` to understand how it works.

### Setup

Adding `fast-check` to a project is as simple as running the following:
```bash
npm install fast-check
```

### Experiment 1: Verifying a round-trip property

The most fundamental property pattern is round-trip: if you encode then decode, you should get back the original.

```js
fc.assert(
  fc.property(fc.string(), fc.integer({ min: 0, max: 25 }), (s, shift) => {
    return caesarDecode(caesarEncode(s, shift), shift) === s;
  }),
  { numRuns: 10000 }
);
// PASSED — 10,000 runs, round-trip holds
```

Verbose test console output should look something like this: 

```
══════════════════════════════════════════════
 Suite 1 · Caesar cipher
══════════════════════════════════════════════
  round-trip on ASCII letters — should pass --> PASSED
  encoding preserves string length — BUG: appends null byte when shift=0 --> FAILED
       Property failed after 2 tests
       { seed: -1085098116, path: "1", endOnFailure: true }
       Counterexample: ["",0]
       Shrunk 0 time(s)

       Execution summary:
       √ ["E",6]
       × ["",0]
  shift 0 is identity — should pass --> PASSED

```

Round-trip properties are powerful because they don't require you to know the "right answer" - you just know that encoding and decoding are inverses. This is a common pattern for serialization, compression, and encryption code.

### Experiment 2: Finding a mutation bug

I wrote a `flattenBuggy` function that uses `Array.splice()` internally, which mutates the input:

```js
function flattenBuggy(arr) {
  const result = [];
  for (const item of arr) {
    if (Array.isArray(item)) {
      result.push(...item.splice(0)); // BUG: splice() mutates the original array
    } else {
      result.push(item);
    }
  }
  return result;
}
```

A traditional unit test might pass if you only check the return value:

```js
expect(flattenBuggy([[1, 2], 3])).toEqual([1, 2, 3]); // passes (wrong reason)
```

But the property "input array is unchanged after calling the function" immediately catches it:

```js
fc.assert(
  fc.property(fc.array(fc.oneof(fc.integer(), fc.array(fc.integer()))), (arr) => {
    const snapshot = JSON.stringify(arr);
    flattenBuggy(arr);
    return JSON.stringify(arr) === snapshot; // input should be unchanged
  }),
  { numRuns: 10000 }
);
// FAILED — function mutates its input!
// Counterexample: [[[],-1467165883,[]]]
// Shrunk 0 time(s) — already minimal
```

Verbose test console output from suite 2:
```
══════════════════════════════════════════════
 Suite 2 · flattenBuggy vs flattenCorrect
══════════════════════════════════════════════
  flattenCorrect: input unchanged after call — should pass --> PASSED
  flattenBuggy: input unchanged after call — BUG: splice() mutates input --> FAILED
       Property failed after 3 tests
       { seed: -545890501, path: "2", endOnFailure: true }
       Counterexample: [[[],[],399375372,671736377,-925833607,850572394,-179969774]]
       Shrunk 0 time(s)

       Execution summary:
       √ [[]]
       √ [[2125488066,[]]]
  flattenCorrect: output length equals sum of all element counts — should pass --> PASSED

```

`fast-check` found the bug on the first run and produced a minimal counterexample immediately (an array containing a nested empty array).

### Experiment 3: Watching shrinking in real time

This is the experiment that illustrates the shrinking algorithm and how it would catch otherwise hard to find bugs. I wrote a function that crashes when processing an order with `quantity > 99` AND a `discount`:

```js
function processOrders(orders) {
  let total = 0;
  for (const order of orders) {
    if (order.quantity > 99 && order.discount) {
      throw new Error('Cannot apply discount to bulk orders');
    }
    total += order.price * order.quantity * (1 - (order.discount || 0));
  }
  return total;
}
```

Running with the verbosity turned up (`FC_VERBOSE=2`) shows every shrinking step:

```
══════════════════════════════════════════════
 Suite 3 · processOrders (shrinking demo)
══════════════════════════════════════════════
  always returns a number — BUG: throws when quantity>99 with a discount --> FAILED
       Property failed after 1 tests
       { seed: 2047245996, path: "0:2:3:1:3:3:2:2:2:2", endOnFailure: true }
       Counterexample: [[{"price":0.01,"quantity":100,"discount":0.01},{"price":0.01,"quantity":1,"discount":undefined}]]
       Shrunk 9 time(s)

       Execution summary:
       × [[{"price":42.5,"quantity":162,"discount":0.19},{__proto__:null,"price":99.92,"quantity":71,"discount":0.12},{"price":0.09,"quantity":3,"discount":0.02}]]
       . √ [[{"price":0.09,"quantity":3,"discount":0.02}]]
  total is always >= 0 for valid inputs — should pass --> PASSED
```

The shrunk counterexample makes the bug obvious: anything with `quantity >= 100` and any discount at all will crash. A traditional test would require you to have thought of this boundary yourself.

### Experiment 4: A property test that passes

Not all `fast-check` runs find bugs, and that's also valuable in validating the code functions well:

```js
// Property: sortedIncludes always finds elements that exist in the array
fc.assert(
  fc.property(
    fc.array(fc.integer({ min: -100, max: 100 }), { minLength: 1 }),
    fc.integer({ min: 0, max: 19 }),
    (arr, idx) => {
      const target = arr[Math.min(idx, arr.length - 1)];
      return sortedIncludes(arr, target) === true;
    }
  ),
  { numRuns: 10000 }
);
// PASSED — 10,000 runs
```

Test result console output:

```
══════════════════════════════════════════════
 Suite 4 · sortedIncludes (binary search)
══════════════════════════════════════════════
  always finds elements that exist in the array — should pass --> PASSED
  never finds elements that are absent — should pass --> PASSED
```

Running 10,000 tests on a binary search implementation and passing gives much stronger confidence than 3-4 hand-written unit tests would.

---

## Designing good properties

The hardest part of property-based testing is the shift in how you approach writing tests and learning to think in properties. Here are the patterns I found most useful:

1. Round-trip / Inverse operations
```
decode(encode(x)) === x
deserialize(serialize(x)) deepEquals x
```

2. Idempotency (calling twice = calling once)
```
normalize(normalize(x)) === normalize(x)
sort(sort(x)) deepEquals sort(x)
```

3. Invariants (something that must always be true)
```
flattenOne(arr).length === sum of all inner lengths
the function does not mutate its input
result is always a finite number
```

4. Commutativity / Associativity
```
add(a, b) === add(b, a)
union(A, union(B, C)) deepEquals union(union(A, B), C)
```

5. Boundary conditions (let `fast-check` explore edge cases you'd miss)
```
result for empty array === some known value
function handles single-element arrays correctly
```

---

## Integrating into a CI/CD pipeline

Fuzz testing fits naturally into a GitHub Actions pipeline. The key insight is that you can save a corpus, a set of previously-found interesting inputs, between runs, so each CI run starts smarter than the last. This is just a simple example of how it could be included into a CI pipeline:

```yaml
# .github/workflows/fuzz.yml
name: Fuzz Tests

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # run nightly for deeper fuzzing

jobs:
  fuzz:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Restore fuzz corpus
        uses: actions/cache@v3
        with:
          path: .fuzz-corpus
          key: fuzz-corpus-${{ github.sha }}
          restore-keys: fuzz-corpus-

      - name: Run fuzz tests
        run: node fuzz.js
        env:
          FC_NUM_RUNS: 50000       # more runs in CI than local
          FC_SEED: ${{ github.run_id }}  # reproducible per run

      - name: Save updated corpus
        uses: actions/cache@v3
        with:
          path: .fuzz-corpus
          key: fuzz-corpus-${{ github.sha }}
```

In the test file, you read the run count from the environment so CI runs more thoroughly than local runs:

```js
fc.assert(
  fc.property(...),
  {
    numRuns: parseInt(process.env.FC_NUM_RUNS || '1000'),
    seed: parseInt(process.env.FC_SEED || Date.now()),
  }
);
```

This way local development stays fast (1,000 runs), but nightly CI runs 50,000 iterations across your whole test suite, with every failure fully reproducible.

---

## What fuzz testing catches vs. traditional unit tests

| Bug type | Unit tests | Fuzz tests |
|---|---|---|
| Known edge cases (null, 0, empty) | If you thought to test them | Always |
| Off-by-one errors | Only if you tested that boundary | Systematically probes boundaries |
| Input mutation bugs | Only if you checked the original | With the right property |
| Unexpected combinations | Combinatorial explosion | Ideal use case for fuzz testing |
| Regression bugs | Covered | Covered when using saved seed |
| Business logic | Fails if you write the wrong test) | Fails if you write the wrong property |

The last item is important: fuzz testing doesn't replace critical thinking and knowledge of business processes. If you write a wrong property, `fast-check` will confidently verify the wrong thing. It's a force multiplier of your reasoning and not a replacement for it (similar to other methods of testing).

---

## Reflection

Going into this I expected property-based testing to be a more complex version of parameterized tests. What I didn't expect was how fundamentally different the thinking required is. Writing a unit test asks "what should this return for input X?" Writing a property asks "what is always true about this function, regardless of input?" That second question is harder, but answering it forces a deeper understanding of what the code is actually supposed to do.

The shrinking algorithm was the piece that impressed me most. Without it, a fuzzer that found a failure in a 50-element array of complex objects would be barely usable. With it, you get handed the minimum possible reproduction every time — often a 1-2 element input that points directly at the bug.

From my very simple tests, I'd argue fuzz testing belongs in the same tier as code coverage. It is not a silver bullet, but should be a key part of a comprehensive testing pipeline. Coverage tells you which lines were executed and fuzz testing tells you which behaviors were exercised. Together they give a much fuller picture and confidence that the code 

---

## References & Related Information

- [fast-check documentation](https://fast-check.dev/) —> Official docs with API reference and examples
- [Hypothesis: Test smarter, not harder](https://hypothesis.works/articles/the-purpose-of-hypothesis/) —> The Python property-based testing library's philosophy (which directly influenced `fast-check`)
- [John Hughes - "Don't Write Tests"](https://www.youtube.com/watch?v=hXnS_Xjwk2Y) —> the creator of QuickCheck (the original property-based testing library) on the paradigm shift required
- [Barton Miller's original fuzz study (1990)](https://pages.cs.wisc.edu/~bart/fuzz/fuzz.html) — where fuzzing as a discipline started
- [fast-check GitHub source](https://github.com/dubzzz/fast-check) — reading the `Arbitrary` base class and shrinking implementation in the source was the most useful thing I did for understanding internals
- [Property-based testing patterns](https://fsharpforfunandprofit.com/posts/property-based-testing-2/) — F# blog but the property patterns section is language-agnostic and excellent
# Async Patterns

Modern asynchronous programming patterns for Node.js applications.

---

## Philosophy

- **async/await everywhere**: Promises are the foundation; async/await is the syntax
- **Concurrent by default**: Run independent operations in parallel, not sequentially
- **Cancellable operations**: Use AbortController for timeouts and user cancellation
- **Backpressure-aware**: Use streams for large data; do not load everything into memory

---

## Promise Combinators

### Promise.all -- All Must Succeed

```javascript
// GOOD: Run independent operations concurrently
async function getUserDashboard(userId) {
  const [user, posts, notifications] = await Promise.all([
    userService.getUser(userId),
    postService.getUserPosts(userId),
    notificationService.getUnread(userId),
  ]);
  return { user, posts, notifications };
}

// BAD: Sequential when operations are independent (2-3x slower)
async function getUserDashboard(userId) {
  const user = await userService.getUser(userId);
  const posts = await postService.getUserPosts(userId);
  const notifications = await notificationService.getUnread(userId);
  return { user, posts, notifications };
}
```

### Promise.allSettled -- Collect All Results

```javascript
// When partial failures are acceptable
async function sendNotifications(userIds) {
  const results = await Promise.allSettled(
    userIds.map(id => notificationService.send(id)),
  );
  const succeeded = results.filter(r => r.status === 'fulfilled');
  const failed = results.filter(r => r.status === 'rejected');
  logger.info({ sent: succeeded.length, failed: failed.length }, 'notifications_sent');
}
```

### When to Use Each

| Combinator | Use Case | Failure Behavior |
|-----------|----------|-----------------|
| `Promise.all` | All tasks must succeed | Rejects on first failure |
| `Promise.allSettled` | Collect all outcomes (partial failure OK) | Never rejects |
| `Promise.race` | First to settle (timeouts) | Settles with first result |
| `Promise.any` | First to succeed (fallbacks) | Rejects only if all fail |

---

## AbortController

### AbortSignal.timeout() -- Built-in Timeout

```javascript
// Node.js 22+: Simpler timeout pattern
async function fetchUser(userId) {
  const response = await fetch(`/api/users/${userId}`, {
    signal: AbortSignal.timeout(5000),
  });
  return response.json();
}
```

### AbortSignal.any() -- Combining Signals

```javascript
async function fetchData(url, userSignal) {
  const response = await fetch(url, {
    signal: AbortSignal.any([userSignal, AbortSignal.timeout(10000)]),
  });
  return response.json();
}
```

### Making Custom APIs Abortable

```javascript
async function processLargeDataset(items, { signal } = {}) {
  const results = [];
  for (const item of items) {
    signal?.throwIfAborted();
    const result = await processItem(item);
    results.push(result);
  }
  return results;
}
```

---

## Stream Patterns

### Readable Streams with async iteration

```javascript
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

// GOOD: Process large files line by line (constant memory)
async function processLogFile(filePath) {
  const fileStream = createReadStream(filePath);
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity });
  let lineCount = 0;
  for await (const line of rl) {
    if (line.includes('ERROR')) lineCount++;
  }
  return lineCount;
}

// BAD: Loading entire file into memory
async function processLogFile(filePath) {
  const content = await readFile(filePath, 'utf-8');  // May OOM on large files
  return content.split('\n').filter(line => line.includes('ERROR')).length;
}
```

### Transform Streams (pipeline)

```javascript
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';

async function compressFile(inputPath, outputPath) {
  await pipeline(
    createReadStream(inputPath),
    createGzip(),
    createWriteStream(outputPath),
  );
}
```

---

## Worker Threads

### CPU-Intensive Tasks

```javascript
import { Worker } from 'node:worker_threads';

function hashPassword(password, salt) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./src/workers/hash-worker.js', {
      workerData: { password, salt },
    });
    worker.on('message', resolve);
    worker.on('error', reject);
  });
}
```

### When to Use Worker Threads

| Task | Use Worker? | Reason |
|------|------------|--------|
| JSON parsing (small) | No | Fast enough on main thread |
| Image processing | Yes | CPU-bound, blocks event loop |
| Cryptographic hashing | Yes | CPU-intensive |
| Database queries | No | Already async I/O |

---

## Concurrency Control

```javascript
// Simple concurrency limiter (or use p-limit package)
async function mapWithConcurrency(items, fn, concurrency = 5) {
  const results = [];
  const executing = new Set();
  for (const item of items) {
    const promise = fn(item).then(result => {
      executing.delete(promise);
      return result;
    });
    executing.add(promise);
    results.push(promise);
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
}
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Unhandled promise rejection | Crashes process | Always `catch` or use process handler |
| `await` inside `forEach` | Does not wait, runs all at once | Use `for...of` or `Promise.all` with `.map()` |
| `new Promise(async ...)` | Unnecessary wrapper | Return the async call directly |
| Mixing callbacks and promises | Inconsistent error handling | Convert callbacks with `util.promisify()` |
| Sequential independent awaits | 2-3x slower than necessary | Use `Promise.all` for independent operations |
| Unbounded parallelism | Overwhelms external services | Use concurrency limiter (p-limit) |

---

_Async code should be simple to read and reason about. Use async/await consistently, run independent work concurrently, and always handle errors._

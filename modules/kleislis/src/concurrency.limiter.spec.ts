import { Task, withConcurrencyLimit } from "./concurrency.limiter";


describe('Concurrency Limiter with Shared Queue', () => {
  test('should share the concurrency limit across multiple functions', async () => {
    const limit = 5;
    const sharedQueue: Task<number>[] = [];
    const totalTasks = 20;

    const asyncOp = async (input: number): Promise<number> => {
      return new Promise(resolve => setTimeout(() => resolve(input), 100));
    };

    const limiter1 = withConcurrencyLimit(limit, sharedQueue, asyncOp);
    const limiter2 = withConcurrencyLimit(limit, sharedQueue, asyncOp);

    const tasks1 = Array.from({ length: 10 }, (_, i) => limiter1(i));
    const tasks2 = Array.from({ length: 10 }, (_, i) => limiter2(i + 10));

    const results = await Promise.all([...tasks1, ...tasks2]);

    expect(results).toHaveLength(totalTasks);
    expect(results).toEqual(Array.from({ length: totalTasks }, (_, i) => i));
  });
});

export default {
  test: {
    include: ["tests/**/*.test.js"],
    environment: "node",
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    fileParallelism: false,
    isolate: false,
  },
};

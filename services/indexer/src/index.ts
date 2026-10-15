import {
  publicClient,
} from "./client.js";

import {
  runSync,
} from "./sync.js";

import {syncBlockTag} from "./sync.js";

await runSync();

publicClient.watchBlocks({
  blockTag: syncBlockTag,
  emitMissed: true,

  onBlock() {
    void runSync().catch(
      (error) => {
        console.error(
          "Indexer sync failed:",
          error
        );
      }
    );
  },

  onError(error) {
    console.error(
      "Block watcher failed:",
      error
    );
  },
});

console.log(
  "Milestone Escrow indexer started"
);
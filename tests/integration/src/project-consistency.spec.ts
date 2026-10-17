import {
  expect,
  request,
  test,
} from "@playwright/test";

import { config } from "./config.js";

import {
  alice,
  aliceWallet,
  bob,
  bobWallet,
  escrowAbi,
  publicClient,
  testClient,
} from "./chain.js";

import {
  signInWithEthereum,
} from "./auth.js";

import {
  type ProjectDto,
  waitForProject,
} from "./project.js";

const cases = [
  {
    name: "different chain client",
    wallet: bobWallet,
    amounts: [800n, 1000n],
  },
  {
    name: "same total but different milestone amounts",
    wallet: aliceWallet,
    amounts: [900n, 900n],
  },
];

for (const scenario of cases) {
  test(
    `rejects ${scenario.name} without blocking later projects`,
    async () => {
      const api = await request.newContext({
        baseURL: config.apiUrl,
      });

      try {
        await signInWithEthereum(api, alice);

        async function createDraft():
          Promise<ProjectDto> {
          const response = await api.post(
            "/projects",
            {
              data: {
                title: "Indexer consistency test",
                description:
                  "A fresh local integration test project.",

                client: alice.address,
                freelancer: bob.address,
                token: config.tokenAddress,

                milestones: ["800", "1000"].map(
                  (amount, index) => ({
                    title: `Milestone ${index + 1}`,
                    description: "Consistency check.",
                    amount,
                  })
                ),
              },
            }
          );

          expect(response.status()).toBe(201);

          return response.json();
        }

        const rejected = await createDraft();

        const badHash =
          await scenario.wallet.writeContract({
            address: config.escrowAddress,
            abi: escrowAbi,
            functionName: "createProject",
            args: [
              rejected.id,
              bob.address,
              config.tokenAddress,
              scenario.amounts,
            ],
          });

        const badReceipt =
          await publicClient.waitForTransactionReceipt({
            hash: badHash,
          });

        expect(badReceipt.status).toBe("success");

        const valid = await createDraft();

        const validHash =
          await aliceWallet.writeContract({
            address: config.escrowAddress,
            abi: escrowAbi,
            functionName: "createProject",
            args: [
              valid.id,
              bob.address,
              config.tokenAddress,
              [800n, 1000n],
            ],
          });

        const validReceipt =
          await publicClient.waitForTransactionReceipt({
            hash: validHash,
          });

        expect(validReceipt.status).toBe("success");

        await testClient.mine({
          blocks: 1,
        });

        await waitForProject(
          api,
          valid.id,
          project => project.onchainCreated
        );

        const response = await api.get(
          `/projects/${rejected.id}`
        );

        expect(response.status()).toBe(200);

        const unchanged: ProjectDto =
          await response.json();

        expect(
          unchanged.onchainCreated
        ).toBe(false);

        expect(
          unchanged.status
        ).toBe("AWAITING_FUNDING");

        expect(
          unchanged.milestones.map(
            milestone => milestone.status
          )
        ).toEqual([
          "PENDING",
          "PENDING",
        ]);
      } finally {
        await api.dispose();
      }
    }
  );
}
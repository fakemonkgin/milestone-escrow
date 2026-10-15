import {
  expect,
  request,
  test,
  type APIRequestContext,
} from "@playwright/test";

import {
  parseUnits,
} from "viem";

import {
  config,
} from "./config.js";

import {
  alice,
  aliceWallet,
  bob,
  escrowAbi,
  publicClient,
  testClient,
  tokenAbi,
} from "./chain.js";

import {
  signInWithEthereum,
} from "./auth.js";

import {
  type ProjectDto,
  waitForProject,
} from "./project.js";


test.describe.serial(
  "Milestone Escrow full flow",
  () => {
    let aliceApi:
      APIRequestContext;

    let bobApi:
      APIRequestContext;


    test.beforeAll(
      async () => {
        aliceApi =
          await request
            .newContext({
              baseURL:
                config.apiUrl,
            });

        bobApi =
          await request
            .newContext({
              baseURL:
                config.apiUrl,
            });


        await signInWithEthereum(
          aliceApi,
          alice
        );

        await signInWithEthereum(
          bobApi,
          bob
        );
      }
    );


    test.afterAll(
      async () => {
        await aliceApi
          .dispose();

        await bobApi
          .dispose();
      }
    );


    test(
      "Alice creates and funds, Bob submits, Alice releases, project completes",
      async () => {

        const amount =
          parseUnits(
            "25",
            6
          );


        //
        // 1. 给 Alice 测试 USDC
        //

        const mintHash =
          await aliceWallet
            .writeContract({
              address:
                config.tokenAddress,

              abi:
                tokenAbi,

              functionName:
                "mint",

              args: [
                alice.address,
                amount,
              ],
            });

        await publicClient
          .waitForTransactionReceipt({
            hash:
              mintHash,
          });


        //
        // 2. Alice 创建链下 Project
        //

        const createResponse =
          await aliceApi.post(
            "/projects",
            {
              data: {
                title:
                  "Integration Test Project",

                description:
                  "End-to-end integration test.",

                client:
                  alice.address,

                freelancer:
                  bob.address,

                token:
                  config.tokenAddress,

                milestones: [
                  {
                    title:
                      "Milestone 1",

                    description:
                      "Deliver integration test milestone.",

                    amount:
                      amount.toString(),
                  },
                ],
              },
            }
          );


        expect(
          createResponse.status()
        ).toBe(201);


        const createdProject:ProjectDto = await createResponse.json();

        expect(
          createdProject.status
        ).toBe(
          "AWAITING_FUNDING"
        );

        expect(
          createdProject.onchainCreated
        ).toBe(false);


        //
        // 3. Alice 链上 createProject
        //

        const createHash =
          await aliceWallet
            .writeContract({
              address:
                config.escrowAddress,

              abi:
                escrowAbi,

              functionName:
                "createProject",

              args: [
                createdProject.id,

                bob.address,

                config.tokenAddress,

                [
                  amount,
                ],
              ],
            });


        await publicClient
          .waitForTransactionReceipt({
            hash:
              createHash,
          });


        await testClient.mine({
          blocks: 1,
        });


        const onchainProject =
          await waitForProject(
            aliceApi,

            createdProject.id,

            (project) =>
              project.onchainCreated
          );


        expect(
          onchainProject
            .onchainCreated
        ).toBe(true);


        //
        // 4. Alice approve Escrow
        //

        const approveHash =
          await aliceWallet
            .writeContract({
              address:
                config.tokenAddress,

              abi:
                tokenAbi,

              functionName:
                "approve",

              args: [
                config.escrowAddress,

                amount,
              ],
            });


        await publicClient
          .waitForTransactionReceipt({
            hash:
              approveHash,
          });


        //
        // 5. Alice fundProject
        //

        const fundHash =
          await aliceWallet
            .writeContract({
              address:
                config.escrowAddress,

              abi:
                escrowAbi,

              functionName:
                "fundProject",

              args: [
                createdProject.id,
              ],
            });


        await publicClient
          .waitForTransactionReceipt({
            hash:
              fundHash,
          });


        await testClient.mine({
          blocks: 1,
        });


        const activeProject =
          await waitForProject(
            aliceApi,

            createdProject.id,

            (project) =>
              project.status ===
              "ACTIVE"
          );


        expect(
          activeProject.status
        ).toBe("ACTIVE");


        //
        // 6. Alice 冒充 Bob 提交
        // 应该被 API 拒绝
        //

        const unauthorizedSubmit =
          await aliceApi.post(
            `/projects/${createdProject.id}/milestones/0/submit`,
            {
              data: {
                submissionNote:
                  "Alice should not be allowed.",

                submissionUrl:
                  "https://example.com/invalid",
              },
            }
          );


        expect(
          unauthorizedSubmit.status()
        ).toBe(403);


        //
        // 7. Bob 正确提交 Milestone
        //

        const submitResponse =
          await bobApi.post(
            `/projects/${createdProject.id}/milestones/0/submit`,
            {
              data: {
                submissionNote:
                  "Milestone completed.",

                submissionUrl:
                  "https://example.com/delivery",
              },
            }
          );


        expect(
          submitResponse.ok()
        ).toBe(true);


        const submittedProject:ProjectDto = await submitResponse.json();
          
        expect(
          submittedProject
            .milestones[0]
            ?.status
        ).toBe(
          "SUBMITTED"
        );


        //
        // 8. 记录 Bob 释放前余额
        //

        const bobBalanceBefore =
          await publicClient
            .readContract({
              address:
                config.tokenAddress,

              abi:
                tokenAbi,

              functionName:
                "balanceOf",

              args: [
                bob.address,
              ],
            });


        //
        // 9. Alice releaseMilestone
        //

        const releaseHash =
          await aliceWallet
            .writeContract({
              address:
                config.escrowAddress,

              abi:
                escrowAbi,

              functionName:
                "releaseMilestone",

              args: [
                createdProject.id,

                0n,
              ],
            });


        await publicClient
          .waitForTransactionReceipt({
            hash:
              releaseHash,
          });


        await testClient.mine({
          blocks: 1,
        });


        //
        // 10. 等 Indexer：
        // SUBMITTED → PAID
        // ACTIVE → COMPLETED
        //

        const completedProject =
          await waitForProject(
            aliceApi,

            createdProject.id,

            (project) =>
              project.status ===
                "COMPLETED" &&
              project
                .milestones[0]
                ?.status ===
                "PAID"
          );


        expect(
          completedProject.status
        ).toBe(
          "COMPLETED"
        );


        expect(
          completedProject
            .milestones[0]
            ?.status
        ).toBe(
          "PAID"
        );


        //
        // 11. Bob 应该真的收到 USDC
        //

        const bobBalanceAfter =
          await publicClient
            .readContract({
              address:
                config.tokenAddress,

              abi:
                tokenAbi,

              functionName:
                "balanceOf",

              args: [
                bob.address,
              ],
            });


        expect(
          bobBalanceAfter -
            bobBalanceBefore
        ).toBe(amount);
      }
    );
  }
);
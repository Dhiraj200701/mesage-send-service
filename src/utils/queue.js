import PQueue from "p-queue";

export const whatsappQueue = new PQueue({
  concurrency: 1
});

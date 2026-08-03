type PipelineStatusBar = {
  status: number;
  name: string;
  count: number;
};

type PipelineStatusChoice = {
  label: string;
  value: number;
};

const pipelineStatusOrder = [
  1, 14, 2, 15, 3, 4, 16, 5, 6, 7, 8, 9, 10, 11, 12, 13, 0, 17, 18, 19,
] as const;

const orderPipelineStatusChoices = (
  choices: readonly PipelineStatusChoice[],
): PipelineStatusChoice[] =>
  pipelineStatusOrder.flatMap((status) => {
    const choice = choices.find((item) => item.value === status);
    return choice ? [choice] : [];
  });

const buildPipelineStatusBars = (
  choices: readonly PipelineStatusChoice[],
  counts: readonly (number | null)[],
): PipelineStatusBar[] =>
  choices.flatMap((choice, index) => {
    const count = counts[index];
    return count != null && count > 0
      ? [{ status: choice.value, name: choice.label, count }]
      : [];
  });

export {
  buildPipelineStatusBars,
  orderPipelineStatusChoices,
  pipelineStatusOrder,
};
export type { PipelineStatusBar, PipelineStatusChoice };

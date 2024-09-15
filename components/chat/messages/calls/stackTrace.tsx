import React, { useState } from 'react';
import { Button, Tooltip } from '@nextui-org/react';
import type { CallFrame } from '@gptscript-ai/gptscript';
import { GoArrowDown, GoArrowUp } from 'react-icons/go';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';

const StackTrace = ({ calls }: { calls: Record<string, CallFrame> | null }) => {
  if (!calls) return null;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [allOpen, setAllOpen] = useState(true);

  // Build tree structure
  const buildTree = (calls: Record<string, CallFrame>) => {
    const tree: Record<string, any> = {};
    const rootNodes: string[] = [];

    // Sort calls by start timestamp
    const sortedCalls = Object.entries(calls).sort((a, b) => 
      new Date(a[1].start).getTime() - new Date(b[1].start).getTime()
    );

    sortedCalls.forEach(([id, call]) => {
      // Skip "Loaded provider from GPTScript Gateway Provider" frames
      if (call.tool?.name === "GPTScript Gateway Provider" && call.type === "callFinish") {
        return;
      }

      const parentId = call.parentID || '';
      if (!parentId) {
        rootNodes.push(id);
      } else {
        if (!tree[parentId]) {
          tree[parentId] = [];
        }
        tree[parentId].push(id);
      }
    });

    return { tree, rootNodes };
  };

  // Render tree recursively
  const renderTree = (nodeId: string, depth: number = 0) => {
    const call = calls[nodeId];
    const children = tree[nodeId] || [];

    return (
      <div key={nodeId} style={{ marginLeft: `${depth * 20}px` }}>
        <details open={allOpen}>
          <Summary call={call} />
          <div className="ml-5">
            <details open={allOpen}>
              <summary className="cursor-pointer">Input</summary>
              <pre className="ml-5 text-xs">{JSON.stringify(call?.input, null, 2)}</pre>
            </details>
            <details open={allOpen}>
              <summary className="cursor-pointer">Output</summary>
              <ul className="ml-5 list-disc">
                {call.output &&
                  call.output.map((output, key) =>
                    output.content && (
                      <li key={key} className="text-xs">
                        {output.content}
                      </li>
                    )
                  )}
              </ul>
            </details>
            {children.map((childId: string) => renderTree(childId, depth + 1))}
          </div>
        </details>
      </div>
    );
  };

  const { tree, rootNodes } = buildTree(calls);

  return (
    <div className="h-full overflow-scroll p-4 rounded-2xl border-2 shadow-lg border-primary border-lg bg-black text-white">
      <Tooltip content={allOpen ? 'Collapse all' : 'Expand all'} closeDelay={0}>
        <Button
          onPress={() => setAllOpen(!allOpen)}
          className="absolute right-8"
          isIconOnly
          radius="full"
          color="primary"
        >
          {allOpen ? <GoArrowUp /> : <GoArrowDown />}
        </Button>
      </Tooltip>
      {rootNodes.map((rootId) => renderTree(rootId))}
    </div>
  );
};

const Summary = ({ call }: { call: CallFrame }) => {
  const name =
    call.tool?.name ||
    call.tool?.source?.repo ||
    call.tool?.source?.location ||
    'main';
  const category = call.toolCategory;
  const idDisplay = `[ID: ${call.id}]`;

  const startTime = new Date(call.start).toLocaleTimeString();
  const endTime = call.end ? new Date(call.end).toLocaleTimeString() : 'In progress';
  const duration = call.end 
    ? `${((new Date(call.end).getTime() - new Date(call.start).getTime()) / 1000).toFixed(2)}s`
    : 'N/A';

  const timeInfo = `(${startTime} - ${endTime}, ${duration})`;

  let summaryContent;
  if (call.tool?.chat) {
    summaryContent = call.type !== 'callFinish'
      ? `Chat open with ${name}`
      : `Chatted with ${name}`;
  } else {
    summaryContent = call.type !== 'callFinish'
      ? category
        ? `Loading ${category} from ${name}` + '...'
        : `Running ${name}`
      : category
        ? `Loaded ${category} from ${name}`
        : `Ran ${name}`;
  }

  return (
    <summary className="cursor-pointer">
      {idDisplay} {summaryContent}{' '}
      <span className="text-xs text-gray-400">{timeInfo}</span>
      {call?.type !== 'callFinish' && (
        <AiOutlineLoading3Quarters className="ml-2 animate-spin inline" />
      )}
    </summary>
  );
};

export default StackTrace;

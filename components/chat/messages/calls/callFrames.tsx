import React, { useState, useRef } from 'react';
import { Button, Tooltip } from '@nextui-org/react';
import type { CallFrame } from '@gptscript-ai/gptscript';
import { FaChevronUp, FaChevronDown } from 'react-icons/fa';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import ReactJson from 'react-json-view';

const CallFrames = ({ calls }: { calls: Record<string, CallFrame> | null }) => {
  if (!calls) return null;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const logsContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [allOpen, setAllOpen] = useState(false);

  const EmptyLogs = () => {
    return (
      <div className="">
        <p>Waiting for the first event from GPTScript...</p>
      </div>
    );
  };

  // Build tree structure
  const buildTree = (calls: Record<string, CallFrame>) => {
    const tree: Record<string, any> = {};
    const rootNodes: string[] = [];

    // Sort calls by start timestamp
    const sortedCalls = Object.entries(calls).sort((a, b) => 
      new Date(a[1].start).getTime() - new Date(b[1].start).getTime()
    );

    sortedCalls.forEach(([id, call]) => {
      // Skip "GPTScript Gateway Provider" calls
      if (call.tool?.name === "GPTScript Gateway Provider") {
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

  // Render input (JSON or text)
  const renderInput = (input: any) => {
    if (typeof input === 'string') {
      try {
        const jsonInput = JSON.parse(input);
        return (
          <ReactJson
            src={jsonInput}
            theme="monokai"
            collapsed={!allOpen}
            displayDataTypes={false}
            enableClipboard={false}
            style={{ backgroundColor: 'transparent', fontSize: 'inherit' }}
          />
        );
      } catch (e) {
        // If parsing fails, render as text
        return <p className="ml-5 whitespace-pre-wrap">{input}</p>;
      }
    }
    // If input is already an object, render as JSON
    return (
      <ReactJson
        src={input}
        theme="monokai"
        collapsed={!allOpen}
        displayDataTypes={false}
        enableClipboard={false}
        style={{ backgroundColor: 'transparent', fontSize: 'inherit' }}
      />
    );
  };

  // Helper function to truncate and stringify input
  const truncateInput = (input: any): string => {
    const stringified = typeof input === 'string' ? input : JSON.stringify(input);
    return stringified.length > 100 ? stringified.slice(0, 100) + '...' : stringified;
  };

  // Render tree recursively
  const renderTree = (nodeId: string, depth: number = 0) => {
    const call = calls[nodeId];
    const children = tree[nodeId] || [];

    return (
      <div key={nodeId} style={{ marginLeft: `${depth * 20}px` }}>
        <details open={depth === 0 || allOpen}>
          <Summary call={call} />
          <div className="ml-5">
            <details open={allOpen}>
              <summary className="cursor-pointer">
                Message to LLM: {truncateInput(call?.input)}
              </summary>
              <div className="ml-5">{renderInput(call?.input)}</div>
            </details>
            <details open={allOpen}>
              <summary className="cursor-pointer">Messages</summary>
              <ul className="ml-5 list-none">
                {call.output && call.output.length > 0 ? (
                  call.output.flatMap((output, key) => {
                    if (output.content) {
                      return [(
                        <li key={`content-${key}`} className="mb-2">
                          <details open={allOpen}>
                            <summary className="cursor-pointer">
                             {truncateInput(output.content)}
                            </summary>
                            <p className="ml-5 whitespace-pre-wrap">{output.content}</p>
                          </details>
                        </li>
                      )];
                    } else if (output.subCalls) {
                      return Object.entries(output.subCalls).map(([subCallKey, subCall]) => (
                        <li key={`subcall-${key}-${subCallKey}`} className="mb-2">
                          <details open={allOpen}>
                            <summary className="cursor-pointer">
                              Tool call: {truncateInput(subCallKey)}
                            </summary>
                            <p className="ml-5 whitespace-pre-wrap">Tool Call ID: {subCallKey}</p>
                            <p className="ml-5 whitespace-pre-wrap">Tool ID: {subCall.toolID}</p>
                            <p className="ml-5 whitespace-pre-wrap">Input: {subCall.input}</p>
                          </details>
                        </li>
                      ));
                    }
                    return [];
                  })
                ) : (
                  <li>
                    <p className="ml-5">No output available</p>
                  </li>
                )}
              </ul>
            </details>
            {children.length > 0 && (
              <details open={allOpen}>
                <summary className="cursor-pointer">Subcalls</summary>
                <div className="ml-5">
                  {children.map((childId: string) => renderTree(childId, depth + 1))}
                </div>
              </details>
            )}
            {(call.llmRequest || call.llmResponse) && (
              <details open={allOpen}>
                <summary className="cursor-pointer">
                  {call.llmRequest && 'messages' in call.llmRequest
                    ? 'LLM Request & Response'
                    : 'Tool Command and Output'}
                </summary>
                <div className="ml-5">
                  {call.llmRequest && (
                    <details open={allOpen}>
                      <summary className="cursor-pointer">
                        {call.llmRequest && 'messages' in call.llmRequest ? 'Request' : 'Command'}
                      </summary>
                      <div className="ml-5">{renderInput(call.llmRequest)}</div>
                    </details>
                  )}
                  {call.llmResponse && (
                    <details open={allOpen}>
                      <summary className="cursor-pointer">
                        {call.llmRequest && 'messages' in call.llmRequest ? 'Response' : 'Output'}
                      </summary>
                      <div className="ml-5">{renderInput(call.llmResponse)}</div>
                    </details>
                  )}
                </div>
              </details>
            )}
          </div>
        </details>
      </div>
    );
  };

  const { tree, rootNodes } = buildTree(calls);

  return (
    <div
      className="h-full overflow-scroll p-4 rounded-2xl border-2 shadow-lg border-primary border-lg bg-black text-white"
      ref={logsContainerRef}
    >
      <Tooltip content={allOpen ? 'Collapse all' : 'Expand all'} closeDelay={0}>
        <Button
          onPress={() => setAllOpen(!allOpen)}
          className="absolute right-8"
          isIconOnly
          radius="full"
          color="primary"
        >
          {allOpen ? <FaChevronUp /> : <FaChevronDown />}
        </Button>
      </Tooltip>
      {rootNodes.length > 0 ? rootNodes.map((rootId) => renderTree(rootId)) : <EmptyLogs />}
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

export default CallFrames;

/**
 * TestCheckStep component
 * Displays detected project info and runs tests during init
 */

import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { Spinner, Select, TextInput } from '@inkjs/ui';
import type { BaseStepProps } from './types.js';
import type { DetectionResult } from '../../services/ProjectDetector.js';
import type { TestResult } from '../../services/TestRunner.js';

export interface TestCheckStepProps extends BaseStepProps {
  readonly detection: DetectionResult;
  readonly onTestComplete: (result: TestResult | null, testCommand: string | null) => void;
  readonly runTests: (testCommand: string) => Promise<TestResult>;
  readonly skipTests?: boolean;
}

type Phase = 'display' | 'confirm' | 'manual-input' | 'running' | 'result';

export const TestCheckStep: React.FC<TestCheckStepProps> = ({
  detection,
  onTestComplete,
  onNext,
  runTests,
  skipTests
}) => {
  const [phase, setPhase] = useState<Phase>('display');
  const [testCommand, setTestCommand] = useState<string>(detection.testCommand ?? '');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [manualInput, setManualInput] = useState('');

  // Use refs for stable callbacks
  const onTestCompleteRef = useRef(onTestComplete);
  const onNextRef = useRef(onNext);
  onTestCompleteRef.current = onTestComplete;
  onNextRef.current = onNext;

  const skipHandledRef = useRef(false);
  const displayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle skip-tests mode
  useEffect(() => {
    if (skipTests && !skipHandledRef.current) {
      skipHandledRef.current = true;
      onTestCompleteRef.current(null, null);
      onNextRef.current();
    }
  }, [skipTests]);

  // Auto-advance from display phase after a brief pause
  useEffect(() => {
    if (phase === 'display' && !skipTests) {
      displayTimerRef.current = setTimeout(() => {
        if (detection.detected) {
          setPhase('confirm');
        } else {
          setPhase('manual-input');
        }
      }, 1500);

      return () => {
        if (displayTimerRef.current) {
          clearTimeout(displayTimerRef.current);
        }
      };
    }
  }, [phase, detection.detected, skipTests]);

  // Handle Enter key on result screen
  useInput((_input, key) => {
    if (phase === 'result' && key.return) {
      onTestCompleteRef.current(testResult, testCommand || null);
      onNextRef.current();
    }
  });

  const handleConfirm = async (value: string) => {
    if (value === 'run' && testCommand) {
      setPhase('running');
      try {
        const result = await runTests(testCommand);
        setTestResult(result);
        setPhase('result');
      } catch {
        setTestResult({
          success: false,
          exitCode: -1,
          stdout: '',
          stderr: 'Failed to run tests',
          durationMs: 0,
          timedOut: false
        });
        setPhase('result');
      }
    } else if (value === 'edit') {
      setManualInput(testCommand);
      setPhase('manual-input');
    } else if (value === 'skip') {
      onTestCompleteRef.current(null, testCommand || null);
      onNextRef.current();
    }
  };

  const handleManualSubmit = async (value: string) => {
    const trimmed = value.trim();
    if (trimmed) {
      setTestCommand(trimmed);
      setPhase('running');
      try {
        const result = await runTests(trimmed);
        setTestResult(result);
        setPhase('result');
      } catch {
        setTestResult({
          success: false,
          exitCode: -1,
          stdout: '',
          stderr: 'Failed to run tests',
          durationMs: 0,
          timedOut: false
        });
        setPhase('result');
      }
    } else {
      // Skip if empty
      onTestCompleteRef.current(null, null);
      onNextRef.current();
    }
  };

  if (skipTests) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text dimColor>Skipping test detection...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Project Test Detection</Text>
      </Box>

      {phase === 'display' && (
        <Box flexDirection="column">
          {detection.detected ? (
            <>
              <Box>
                <Text color="green">Detected test command from </Text>
                <Text color="yellow">{detection.source}</Text>
                <Text color="green">:</Text>
              </Box>
              <Box marginLeft={2} marginTop={1}>
                <Text color="cyan">{detection.testCommand}</Text>
              </Box>
              <Box marginTop={1}>
                <Text dimColor>Confidence: {detection.confidence}</Text>
              </Box>
            </>
          ) : (
            <Box>
              <Text dimColor>No test command detected automatically.</Text>
            </Box>
          )}
        </Box>
      )}

      {phase === 'confirm' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>Run tests with: </Text>
            <Text color="cyan">{testCommand}</Text>
          </Box>
          <Select
            options={[
              { value: 'run', label: 'Run tests now' },
              { value: 'edit', label: 'Enter different command' },
              { value: 'skip', label: 'Skip tests' }
            ]}
            onChange={handleConfirm}
          />
        </Box>
      )}

      {phase === 'manual-input' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>Enter test command (or press Enter to skip):</Text>
          </Box>
          <TextInput
            placeholder="npm test"
            defaultValue={manualInput}
            onSubmit={handleManualSubmit}
          />
        </Box>
      )}

      {phase === 'running' && (
        <Box flexDirection="column">
          <Spinner label={`Running: ${testCommand}`} />
        </Box>
      )}

      {phase === 'result' && testResult && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            {testResult.success ? (
              <Box>
                <Text color="green">{'\u2713'} </Text>
                <Text bold color="green">
                  Tests passed in {(testResult.durationMs / 1000).toFixed(1)}s
                </Text>
              </Box>
            ) : (
              <Box>
                <Text color="red">{'\u2717'} </Text>
                <Text bold color="red">
                  Tests failed {testResult.timedOut ? '(timed out)' : `(exit code: ${testResult.exitCode})`}
                </Text>
              </Box>
            )}
          </Box>
          {!testResult.success && testResult.stderr && (
            <Box marginBottom={1} marginLeft={2}>
              <Text color="red" dimColor>
                {testResult.stderr.split('\n').slice(0, 3).join('\n')}
              </Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text dimColor>Press Enter to continue...</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};

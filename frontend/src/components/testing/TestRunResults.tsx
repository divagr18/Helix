// src/components/testing/TestRunResults.tsx
import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export const TestRunResults: React.FC<{ result: any }> = ({ result }) => {
    const isSuccess = result.exit_code === 0;
    const hasError = result.error || result.exit_code !== 0;

    return (
        <div className="border-t-2 bg-card/95 backdrop-blur-sm p-4">
            <div className="flex items-center gap-3">
                {isSuccess ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                ) : (
                    <XCircle className="h-6 w-6 text-destructive" />
                )}
                <h3 className="text-lg font-semibold">
                    {isSuccess ? "Tests Passed" : "Tests Failed"}
                </h3>
            </div>

            <Accordion type="single" collapsible className="w-full mt-2">
                {result.stdout && (
                    <AccordionItem value="stdout">
                        <AccordionTrigger>Standard Output</AccordionTrigger>
                        <AccordionContent>
                            <pre className="text-xs bg-background p-2 rounded-md max-h-48 overflow-auto">
                                <code>{result.stdout}</code>
                            </pre>
                        </AccordionContent>
                    </AccordionItem>
                )}
                {result.stderr && (
                    <AccordionItem value="stderr">
                        <AccordionTrigger className="text-yellow-500">
                            <AlertTriangle className="mr-2 h-4 w-4" /> Standard Error
                        </AccordionTrigger>
                        <AccordionContent>
                            <pre className="text-xs bg-background p-2 rounded-md max-h-48 overflow-auto">
                                <code>{result.stderr}</code>
                            </pre>
                        </AccordionContent>
                    </AccordionItem>
                )}
            </Accordion>
            {/* We can add a button here to auto-upload the result.coverage_xml */}
        </div>
    );
};
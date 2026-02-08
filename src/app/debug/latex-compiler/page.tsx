'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLatexCompiler } from '@/hooks/latex/use-latex-compiler';
import { Loader2 } from 'lucide-react';

const DEFAULT_LATEX = `\\documentclass{article}
\\begin{document}
\\section{Hello World}
This is a minimal LaTeX document for testing the compiler.

\\textbf{Bold text} and \\textit{italic text}.

\\begin{itemize}
  \\item First item
  \\item Second item
\\end{itemize}
\\end{document}`;

export default function LatexCompilerDebugPage() {
    const [source, setSource] = useState(DEFAULT_LATEX);
    const { compile, isCompiling, logs, pdfUrl, error } = useLatexCompiler();

    const handleCompile = async () => {
        await compile(source);
    };

    return (
        <div className="container mx-auto p-8 max-w-7xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">LaTeX Compiler Debug</h1>
                <p className="text-muted-foreground">
                    Test the WASM LaTeX compilation pipeline in isolation
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Editor */}
                <Card>
                    <CardHeader>
                        <CardTitle>LaTeX Source</CardTitle>
                        <CardDescription>Edit the LaTeX code below</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            value={source}
                            onChange={(e) => setSource(e.target.value)}
                            className="font-mono min-h-[400px]"
                            placeholder="Enter LaTeX source..."
                        />
                        <Button
                            onClick={handleCompile}
                            disabled={isCompiling}
                            className="mt-4 w-full"
                        >
                            {isCompiling ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Compiling...
                                </>
                            ) : (
                                'Compile'
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* Right: Output */}
                <div className="flex flex-col gap-6">
                    {/* Logs */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Compiler Logs</CardTitle>
                            <CardDescription>stdout/stderr from the compiler</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <pre className="bg-muted p-4 rounded-md overflow-auto max-h-[200px] text-xs">
                                {logs || 'No logs yet. Click "Compile" to start.'}
                            </pre>
                        </CardContent>
                    </Card>

                    {/* Error Display */}
                    {error && (
                        <Card className="border-destructive">
                            <CardHeader>
                                <CardTitle className="text-destructive">Compilation Error</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-destructive">{error}</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* PDF Preview */}
                    {pdfUrl && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Output</CardTitle>
                                <CardDescription>Generated PDF</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <a
                                    href={pdfUrl}
                                    download="output.pdf"
                                    className="inline-block"
                                >
                                    <Button variant="outline" className="w-full">
                                        Download PDF
                                    </Button>
                                </a>
                                <div className="mt-4 border rounded-md overflow-hidden">
                                    <iframe
                                        src={pdfUrl}
                                        className="w-full h-[400px]"
                                        title="PDF Preview"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}

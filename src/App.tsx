import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import MarkdownRenderer from "./components/MarkdownRenderer";

function App() {
  const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
  const [message, setMessage] = useState("");
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const streamDeepSeek = async () => {
    if (!question.trim()) {
      setError("Please enter a question");
      return;
    }

    setIsLoading(true);
    setError("");
    setMessage("");

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": window.location.origin,
            "X-Title": "DeepSeek AI Streamer",
          },
          body: JSON.stringify({
            model: "deepseek/deepseek-r1-zero:free",
            messages: [
              {
                role: "system",
                content:
                  "Please provide a concise response without unnecessary details. Make it as clear and concise as possible.",
              },
              {
                role: "user",
                content: question,
              },
            ],
            stream: true,
          }),
          signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error?.message || `HTTP error! status: ${response.status}`
        );
      }

      // Get the response body as a readable stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("ReadableStream not supported");
      }

      // Read the stream
      const decoder = new TextDecoder();
      let streamedMessage = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode the stream chunk
        const chunk = decoder.decode(value, { stream: true });

        // Process the SSE data
        const lines = chunk
          .split("\n")
          .filter((line) => line.trim() !== "" && line.startsWith("data: "));

        for (const line of lines) {
          const data = line.substring(6); // Remove "data: " prefix

          if (data === "[DONE]") {
            continue;
          }

          try {
            const parsedData = JSON.parse(data);
            if (parsedData.choices && parsedData.choices[0]) {
              const delta =
                parsedData.choices[0].delta?.content ||
                parsedData.choices[0].delta?.reasoning ||
                "";
              if (delta) {
                streamedMessage += delta;
                setMessage(cleanLatexSyntax(streamedMessage));
              }
            }
          } catch (e) {
            console.error("Error parsing SSE data:", e);
          }
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        console.error("Error:", err);
        setError(
          (err as Error).message ||
            "An error occurred while fetching the response"
        );
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  function cleanLatexSyntax(text: string) {
    // Replace \boxed{content} with content
    return text.replace(/\\boxed\{([^}]*)\}/g, "$1");
  }

  const cancelStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      streamDeepSeek();
    }
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);


  return (
    <div className="container mx-auto p-2 sm:p-4 max-w-4xl">
      <div className="flex justify-center gap-4 mb-4 sm:mb-6">
        <a href="https://vitejs.dev" target="_blank" rel="noreferrer">
          <img
            src={viteLogo}
            className="h-8 w-8 sm:h-12 sm:w-12"
            alt="Vite logo"
          />
        </a>
        <a href="https://react.dev" target="_blank" rel="noreferrer">
          <img
            src={reactLogo}
            className="h-8 w-8 sm:h-12 sm:w-12 animate-spin-slow"
            alt="React logo"
          />
        </a>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8">
        DeepSeek AI with OpenRouter
      </h1>

      <Card className="mx-2 sm:mx-0">
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="text-lg sm:text-xl">Ask DeepSeek</CardTitle>
          <CardDescription className="text-sm">
            Enter your question and get a response from DeepSeek AI
          </CardDescription>
        </CardHeader>

        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
          <div className="space-y-3 sm:space-y-4">
            <div className="grid w-full gap-2">
              <Textarea
                placeholder="Enter your question here..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyPress}
                className="min-h-20 sm:min-h-24 resize-none text-sm sm:text-base"
              />
              {error && (
                <p className="text-xs sm:text-sm text-red-500">{error}</p>
              )}
            </div>

            {message && (
              <Card className="bg-muted/50">
                <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-4">
                  <CardTitle className="text-base sm:text-lg">
                    Response
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 text-sm sm:text-base">
                  <MarkdownRenderer content={message} />
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>

        <CardFooter className="p-3 sm:p-6 pt-0 sm:pt-0">
          <Button
            onClick={streamDeepSeek}
            disabled={isLoading}
            className="h-10 sm:h-11 mx-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span className="text-sm sm:text-base">Thinking...</span>
              </>
            ) : (
              <span className="text-sm sm:text-base">Ask DeepSeek</span>
            )}
          </Button>
          <br />
          {isLoading && (
            <Button onClick={cancelStream} className="h-10 sm:h-11">
              Cancel
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

export default App;

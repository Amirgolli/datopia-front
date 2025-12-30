"use client";

import { useParams } from "next/navigation";
import {
  ArrowUp,
  CirclePlus,
  Copy,
  Pencil,
  RefreshCw,
  Check,
  Square,
  Download,
} from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import Cookies from "js-cookie";
import { Button } from "@/components/Button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import Logo from "../../../../public/svg/Logo";
import UserA from "../../../../public/svg/userA";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const AGENT_STATUS_TEXTS = [
  // ⏳ صمیمی و انسانی
  "یه لحظه ⏳",
  "اعداد دارن باهام حرف می‌زنن…",
  "کمی صبر کن… تحلیل خوب عجله‌ای درنمیاد 😉",
  "دارم الگوها رو شکار می‌کنم 🧠✨",
  "در حال جوش دادن داده‌ها…",
  "داده‌ها رفتن زیر ذره‌بین، نتیجه نزدیکه 🔍",

  // 😎 کوتاه و مناسب اسپینر
  "تحلیل در جریانه…",
  "در حال رمزگشایی داده‌ها…",
  "دارم محاسبه می‌کنم…",
  "تقریباً آماده‌ایم…",

  // 🤖 AI-محور
  "دیتوپیا مشغول فکر کردنه 🤖",
  "الگوریتم‌ها در حال کارن…",
  "نتایج هوشمند در راهه…",
];

export default function ChatPage() {
  const [agentStatusText, setAgentStatusText] = useState("");
  const { sessionId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editInput, setEditInput] = useState("");
  const [user, setUser] = useState("شما");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const currentStreamInterval = useRef<NodeJS.Timeout | null>(null);
  const manuallyTriggeredRef = useRef(false);
  const [isMobile, setIsMobile] = useState(false);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [credit, setCredit] = useState<number | null>(null);
  const [isCreditZeroModalOpen, setIsCreditZeroModalOpen] = useState(false);

  useEffect(() => {
    if (!isLoading) return;

    let lastText = "";

    const pickRandomText = () => {
      const available = AGENT_STATUS_TEXTS.filter((text) => text !== lastText);
      const selected = available[Math.floor(Math.random() * available.length)];

      lastText = selected;
      setAgentStatusText(selected);
    };

    pickRandomText(); // اولین بار فوری
    const interval = setInterval(pickRandomText, 2500);

    return () => clearInterval(interval);
  }, [isLoading]);

  const readCredit = () => {
    const raw = localStorage.getItem("userCredit");
    if (raw === null) {
      setCredit(null);
      setIsCreditZeroModalOpen(false);
      return;
    }
    const num = Number(raw);
    if (!isNaN(num)) {
      setCredit(num);
      setIsCreditZeroModalOpen(num <= 0);
    } else {
      setCredit(null);
      setIsCreditZeroModalOpen(false);
    }
  };
  const handleDownloadImage = (base64: string, filename = "image.png") => {
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${base64}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    readCredit();
    window.addEventListener("storage", readCredit);
    window.addEventListener("creditUpdated", readCredit as EventListener);
    return () => {
      window.removeEventListener("storage", readCredit);
      window.removeEventListener("creditUpdated", readCredit as EventListener);
    };
  }, []);

  const remainderCredit = credit ?? 500;

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    setUser(Cookies.get("user_name") || "شما");

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const getToken = () => {
    return Cookies.get("access_token");
  };

  useEffect(() => {
    const loadMessages = async () => {
      const storedMessages = localStorage.getItem(`chat_${sessionId}`);
      if (storedMessages) {
        try {
          const parsed = JSON.parse(storedMessages) as Message[];
          setMessages(parsed);
          return;
        } catch (error) {
          console.error("Error parsing messages:", error);
        }
      }

      try {
        const response = await fetch(
          `${apiBaseUrl}/chat/get_history/${sessionId}`
        );
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        const data = await response.json();
        const history = data.messages || [];
        setMessages(history);
        localStorage.setItem(`chat_${sessionId}`, JSON.stringify(history));
      } catch (error) {
        console.error("Error fetching history:", error);
        setMessages([]);
      }
    };

    loadMessages();
  }, [sessionId, apiBaseUrl]);

  const handleGetResponse = useCallback(
    async (content: string, refreshIndex?: number) => {
      const trimmedInput = content.trim();
      if (!trimmedInput) return;

      setIsLoading(true);

      let baseMessages: Message[] = [];

      setMessages((prev) => {
        if (refreshIndex !== undefined) {
          baseMessages = prev.slice(0, refreshIndex);
          return baseMessages;
        } else {
          const last = prev[prev.length - 1];
          if (last && last.role === "user" && last.content === trimmedInput) {
            baseMessages = prev;
            return prev;
          } else {
            baseMessages = [...prev, { role: "user", content: trimmedInput }];
            return baseMessages;
          }
        }
      });

      try {
        const token = getToken();
        if (!token) {
          throw new Error("No auth token found. Please log in again.");
        }

        const response = await fetch(`${apiBaseUrl}/chat/send_message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            session_id: sessionId,
            content: trimmedInput,
          }),
        });

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();

        // Store the entire data as JSON string in content
        const assistantContent = JSON.stringify(data);

        // For streaming, use model_response if available
        const streamText = data.model_response || "";
        const words = streamText.split(" ");
        let currentMessage = "";
        let wordIndex = 0;

        if (currentStreamInterval.current) {
          clearInterval(currentStreamInterval.current);
          currentStreamInterval.current = null;
        }

        currentStreamInterval.current = setInterval(() => {
          if (wordIndex < words.length) {
            currentMessage += (wordIndex > 0 ? " " : "") + words[wordIndex];
            setMessages(() => [
              ...baseMessages,
              {
                role: "assistant",
                content: JSON.stringify({
                  ...data,
                  model_response: currentMessage,
                }),
              } as Message,
            ]);
            wordIndex++;
          } else {
            if (currentStreamInterval.current) {
              clearInterval(currentStreamInterval.current);
              currentStreamInterval.current = null;
            }
            setIsLoading(false);
            const finalMessages: Message[] = [
              ...baseMessages,
              { role: "assistant", content: assistantContent } as Message,
            ];
            setMessages(finalMessages);
            localStorage.setItem(
              `chat_${sessionId}`,
              JSON.stringify(finalMessages)
            );
          }
        }, 100 + Math.random() * 50);
      } catch (error) {
        console.error("Error sending message:", error);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "خطا در دریافت پاسخ از سرور! (احتمالاً مشکل احراز هویت)",
          } as Message,
        ]);
        setIsLoading(false);
      }
    },
    [sessionId, apiBaseUrl]
  );

  useEffect(() => {
    if (messages.length > 0 && !isLoading && !manuallyTriggeredRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === "user") {
        handleGetResponse(lastMsg.content);
      }
    }
  }, [messages, handleGetResponse, isLoading]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(
        inputRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [input]);

  useEffect(() => {
    if (editRef.current) {
      editRef.current.style.height = "auto";
      editRef.current.style.height = `${Math.min(
        editRef.current.scrollHeight,
        150
      )}px`;
    }
  }, [editInput]);

  const handleSubmit = async (e: React.FormEvent, refreshIndex?: number) => {
    e.preventDefault();

    if (remainderCredit <= 0) {
      console.warn("کاربر تلاش به ارسال پیام کرده اما اعتبار تمام شده.");
      return;
    }

    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    setIsLoading(true);

    let newMessages: Message[];
    if (refreshIndex !== undefined) {
      newMessages = [...messages.slice(0, refreshIndex)];
    } else {
      newMessages = [
        ...messages,
        { role: "user", content: trimmedInput } as Message,
      ];
    }

    manuallyTriggeredRef.current = true;
    setMessages(newMessages);
    setInput("");

    try {
      await handleGetResponse(trimmedInput, refreshIndex);
    } finally {
      manuallyTriggeredRef.current = false;
    }
  };

  const handleStopGeneration = () => {
    if (currentStreamInterval.current) {
      clearInterval(currentStreamInterval.current);
      currentStreamInterval.current = null;
    }
    setIsLoading(false);
    localStorage.setItem(`chat_${sessionId}`, JSON.stringify(messages));
  };

  const handleCopy = async (
    text: string,
    index: number,
    isCode: boolean = false
  ) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }

      if (isCode) {
        setCopiedCodeIndex(index);
        setTimeout(() => setCopiedCodeIndex(null), 1500);
      } else {
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 1500);
      }
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  const handleEdit = (index: number, content: string) => {
    setEditingIndex(index);
    setEditInput(content);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditInput("");
  };

  const handleConfirmEdit = async (index: number) => {
    const trimmedInput = editInput.trim();
    if (!trimmedInput) return;

    setIsLoading(true);

    try {
      const token = getToken();
      if (!token) {
        throw new Error("No auth token found. Please log in again.");
      }

      console.log("Sending to /chat/edit_message:", {
        session_id: sessionId,
        message_index: index,
        new_content: trimmedInput,
      });
      const response = await fetch(`${apiBaseUrl}/chat/edit_message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          message_index: index,
          new_content: trimmedInput,
        }),
      });
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const newMessages = data.messages || [];
      setMessages(newMessages);
      localStorage.setItem(`chat_${sessionId}`, JSON.stringify(newMessages));

      if (
        newMessages.length > 0 &&
        newMessages[newMessages.length - 1].role === "assistant"
      ) {
        const assistantData = newMessages[newMessages.length - 1].content;
        if (typeof assistantData !== "string") {
          throw new Error("Assistant response is not text");
        }

        // Parse the JSON content
        let parsedData;
        try {
          parsedData = JSON.parse(assistantData);
        } catch {
          throw new Error("Invalid JSON in assistant response");
        }

        const streamText = parsedData.model_response || "";
        const words = streamText.split(" ");
        let currentMessage = "";
        let wordIndex = 0;
        const baseMessages = newMessages.slice(0, -1);

        if (currentStreamInterval.current) {
          clearInterval(currentStreamInterval.current);
          currentStreamInterval.current = null;
        }

        currentStreamInterval.current = setInterval(() => {
          if (wordIndex < words.length) {
            currentMessage += (wordIndex > 0 ? " " : "") + words[wordIndex];
            setMessages([
              ...baseMessages,
              {
                role: "assistant",
                content: JSON.stringify({
                  ...parsedData,
                  model_response: currentMessage,
                }),
              },
            ]);
            wordIndex++;
          } else {
            if (currentStreamInterval.current) {
              clearInterval(currentStreamInterval.current);
              currentStreamInterval.current = null;
            }
            setMessages(newMessages);
          }
        }, 100 + Math.random() * 50);
      }
    } catch (error) {
      console.error("Error editing message:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "خطا در ویرایش پیام و دریافت پاسخ! (احتمالاً مشکل احراز هویت)",
        },
      ]);
    } finally {
      setIsLoading(false);
      setEditingIndex(null);
      setEditInput("");
    }
  };

  const handleRefresh = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (index > 0 && messages[index - 1].role === "user") {
      const userMessage = messages[index - 1].content;
      handleGetResponse(userMessage, index);
    }
  };

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-between bg-background">
      <div className="h-12 w-full fixed top-0 z-50 bg-white border-b md:hidden flex items-center  px-6">
        <SidebarTrigger />
      </div>
      <div className="max-w-[832px] w-full px-4 pt-20 pb-8 flex flex-col flex-1 ">
        <div className="flex-1 overflow-y-auto space-y-6 px-2 mb-8">
          {messages.length === 0 && (
            <p className="text-center text-gray-500">هیچ پیامی یافت نشد.</p>
          )}

          {messages.map((msg, index) => {
            // Parse msg.content as JSON if it's assistant response
            let responseData;
            try {
              responseData = JSON.parse(msg.content);
            } catch {
              responseData = {
                model_response: msg.content,
                generated_code: null,
                plot_base64: null,
              };
            }

            const { model_response, generated_code, plot_base64 } =
              responseData;
            const plotImageSrc = plot_base64
              ? `data:image/png;base64,${plot_base64}`
              : null;
            const hasModelResponse =
              model_response && model_response.trim() !== "";

            return (
              <div key={index} className="flex flex-col text-right">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center  text-xs font-medium">
                    {msg.role === "user" ? (
                      <UserA />
                    ) : (
                      <Logo height={80} width={80} />
                    )}
                  </div>
                  <span className="text-sm font-semibold">
                    {msg.role === "user" ? user : "دیتوپیا"}
                  </span>
                </div>

                <div className="max-w-[90%] break-words px-3 py-2 text-sm rounded-lg">
                  {editingIndex === index && msg.role === "user" ? (
                    <>
                      <textarea
                        ref={editRef}
                        value={editInput}
                        onChange={(e) => setEditInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleConfirmEdit(index);
                          }
                        }}
                        className="w-full min-h-9 px-2 py-2 text-sm border border-[#E4E4E7] rounded-lg resize-none overflow-auto text-right outline-none max-h-[200px]"
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant={"ghost"}
                          onClick={handleCancelEdit}
                          className="px-3 py-1 text-sm h-8 w-15"
                        >
                          انصراف
                        </Button>
                        <Button
                          onClick={() => handleConfirmEdit(index)}
                          className="px-3 py-1 text-sm h-8 w-15"
                        >
                          تایید
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      {hasModelResponse && (
                        <ReactMarkdown
                          rehypePlugins={[rehypeHighlight]}
                          components={{
                            p: ({ children }) => (
                              <p className="text-sm leading-6 text-gray-800">
                                {children}
                              </p>
                            ),
                            code: ({ className, children, ...props }) => {
                              const match = /language-(\w+)/.exec(
                                className || ""
                              );
                              return match ? (
                                <pre
                                  dir="ltr"
                                  className="bg-[#2F2F2F] p-4 rounded-xl text-sm font-mono leading-relaxed text-white shadow-sm border border-[#3A3A3A] text-left"
                                >
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                </pre>
                              ) : (
                                <code
                                  className="bg-[#E5E7EB] px-1.5 py-0.5 rounded-md text-sm font-mono text-gray-800"
                                  {...props}
                                >
                                  {children}
                                </code>
                              );
                            },
                            h1: ({ children }) => (
                              <h1 className="text-xl font-bold mt-4 mb-2 text-gray-900">
                                {children}
                              </h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="text-lg font-semibold mt-3 mb-2 text-gray-900">
                                {children}
                              </h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="text-base font-semibold mt-2 mb-1 text-gray-900">
                                {children}
                              </h3>
                            ),
                            ul: ({ children }) => (
                              <ul className="list-disc list-inside text-sm text-gray-800 my-2">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="list-decimal list-inside text-sm text-gray-800 my-2">
                                {children}
                              </ol>
                            ),
                            li: ({ children }) => (
                              <li className="my-1">{children}</li>
                            ),
                            a: ({ href, children }) => (
                              <a
                                href={href}
                                className="text-blue-600 hover:underline hover:text-blue-800"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {children}
                              </a>
                            ),
                          }}
                        >
                          {model_response}
                        </ReactMarkdown>
                      )}

                      {generated_code && (
                        <div dir="ltr" className="mt-4 relative text-left">
                          <button
                            onClick={() =>
                              handleCopy(generated_code, index, true)
                            }
                            className={`absolute top-2 right-3 copy-button inline-flex items-center gap-1 opacity-90 hover:opacity-100 transition-all duration-200 ${
                              copiedCodeIndex === index ? "copied" : ""
                            }`}
                            aria-label="کپی کد"
                          >
                            {copiedCodeIndex === index ? (
                              <Check className="w-4 h-4 check-icon " />
                            ) : (
                              <Copy
                                className="w-4 h-4 cursor-pointer"
                                color="gray"
                              />
                            )}
                          </button>
                          <ReactMarkdown
                            rehypePlugins={[rehypeHighlight]}
                            components={{
                              code: ({ className, children, ...props }) => (
                                <pre className="bg-[#2F2F2F] p-4 rounded-xl text-sm font-mono leading-relaxed text-white shadow-sm border border-[#3A3A3A] overflow-auto">
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                </pre>
                              ),
                            }}
                          >
                            {`\`\`\`python\n${generated_code}\n\`\`\``}
                          </ReactMarkdown>
                        </div>
                      )}

                      {plotImageSrc && (
                        <div className="mt-4 text-center flex  flex-col gap-4">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={plotImageSrc}
                            alt="Generated Plot"
                            className="max-w-full h-auto rounded-lg shadow-md"
                          />

                          <button
                            onClick={() =>
                              handleDownloadImage(
                                plot_base64,
                                `plot-${index}.png`
                              )
                            }
                            className="  h-7 w-7 cursor-pointer self-end"
                            aria-label="دانلود تصویر"
                          >
                            <Download className="w-4 h-4" color="gray" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {!(editingIndex === index && msg.role === "user") && (
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <button
                      onClick={() =>
                        handleCopy(model_response || msg.content, index)
                      }
                      className={`copy-button inline-flex items-center gap-1 opacity-90 hover:opacity-100 transition-all duration-200 ${
                        copiedIndex === index ? "copied" : ""
                      }`}
                      aria-label="کپی پیام"
                    >
                      {copiedIndex === index ? (
                        <Check className="w-4 h-4 check-icon text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    {msg.role === "user" && (
                      <button
                        onClick={() => handleEdit(index, msg.content)}
                        className="inline-flex items-center gap-1 opacity-90 hover:opacity-100 transition-all duration-200"
                        aria-label="ویرایش پیام"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}

                    {msg.role === "assistant" && (
                      <button
                        onClick={(e) => handleRefresh(index, e)}
                        className="inline-flex items-center gap-1 opacity-90 hover:opacity-100 transition-all duration-200"
                        aria-label="رفرش پیام"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {isLoading &&
            messages.length > 0 &&
            messages[messages.length - 1].role === "user" && (
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-2 mr-11">
                <span className="animate-pulse">●</span>
                <span>{agentStatusText}</span>
              </div>
            )}

          <div ref={messagesEndRef} />
        </div>

        <form
          onSubmit={!isLoading ? handleSubmit : (e) => e.preventDefault()}
          className="flex flex-col items-center fixed bottom-5 w-[92%] md:w-[800px] h-auto"
        >
          <div className="flex items-center w-full bg-white border border-[#E4E4E7] rounded-2xl px-3">
            <button
              type="button"
              className="inline-flex items-center justify-center h-6 w-6 rounded-full text-white"
            >
              <CirclePlus className="w-5 h-5 text-slate-400" />
            </button>

            <textarea
              ref={inputRef}
              rows={1}
              placeholder="پیام خود را بنویسید..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (!isMobile && e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e as unknown as React.FormEvent);
                }
              }}
              className="flex items-center w-full min-h-9 px-2 py-4 text-sm border-none resize-none text-right outline-none overflow-auto max-h-[200px]"
              disabled={isLoading || remainderCredit <= 0}
            />

            {isLoading ? (
              <button
                type="button"
                onClick={handleStopGeneration}
                className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium bg-black text-white hover:bg-gray-800 transition-colors duration-200 shadow-md hover:shadow-lg"
                aria-label="توقف پاسخ"
              >
                <Square className="w-5 h-5" />
              </button>
            ) : (
              <Button
                type="submit"
                disabled={!input.trim() || remainderCredit <= 0}
                className={`inline-flex items-center justify-center w-9 h-9 rounded-full ${
                  input.trim() && remainderCredit > 0
                    ? "bg-black text-white hover:bg-gray-800 transition-colors duration-200 shadow-md hover:shadow-lg"
                    : "bg-gray-400 text-white opacity-50 cursor-default"
                }`}
              >
                <ArrowUp className="w-6 h-6" />
              </Button>
            )}
          </div>
        </form>
      </div>

      {isCreditZeroModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-lg p-6 max-w-sm w-[90%] z-60 shadow-lg text-right">
            <h3 className="text-lg font-semibold mb-2">اعتبار به پایان رسید</h3>
            <p className="text-sm text-gray-700 mb-4">
              اعتبار شما به پایان رسیده است. تا زمان شارژ مجدد امکان ارسال پیام
              وجود ندارد.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setIsCreditZeroModalOpen(false)}
                className="px-3 py-1 rounded bg-gray-100"
              >
                باشه
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

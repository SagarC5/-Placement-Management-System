import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Mic, MicOff, Video, VideoOff, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConversation } from "@11labs/react";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: "interviewer" | "candidate";
  content: string;
  timestamp: string;
  highlighted?: boolean;
}

interface FeedbackInsight {
  type: "strength" | "improvement" | "tip";
  content: string;
  timestamp: string;
}

export const AIInterviewInterface = () => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMomentum, setCurrentMomentum] = useState(0);
  const [performance, setPerformance] = useState(0);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [feedbackInsights, setFeedbackInsights] = useState<FeedbackInsight[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const wasManualDisconnectRef = useRef(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const maxReconnectAttempts = 3;
  const [interviewStats, setInterviewStats] = useState({
    totalQuestions: 0,
    answersGiven: 0,
    avgResponseLength: 0,
    technicalDepth: 0,
    communicationClarity: 0,
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const conversation = useConversation({
    onConnect: () => {
      console.log("Connected to ElevenLabs");
      toast({
        title: "Interview Started",
        description: "AI interviewer is ready. Good luck!",
      });
    },
    onDisconnect: () => {
      console.log("Disconnected from ElevenLabs - checking if intentional");
      
      // Only attempt auto-reconnect if disconnect was not manual
      if (!wasManualDisconnectRef.current && reconnectAttempts < maxReconnectAttempts) {
        console.log(`Auto-reconnecting (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
        setIsReconnecting(true);
        setReconnectAttempts(prev => prev + 1);
        
        toast({
          title: "Reconnecting...",
          description: `Attempting to restore interview connection (${reconnectAttempts + 1}/${maxReconnectAttempts})`,
        });
        
        // Attempt reconnect after 2 seconds
        setTimeout(() => {
          startInterview();
        }, 2000);
      } else if (!wasManualDisconnectRef.current) {
        toast({
          title: "Connection Failed",
          description: "Unable to maintain connection. Please check your internet and try again.",
          variant: "destructive",
        });
        setIsReconnecting(false);
      } else {
        console.log("Manual disconnect detected - not reconnecting");
        wasManualDisconnectRef.current = false; // Reset for next time
        setIsReconnecting(false);
      }
    },
    onMessage: (message) => {
      console.log("Received message:", message);
      
      // ElevenLabs message handling - type may vary
      if (typeof message === 'object' && message !== null) {
        const msg = message as any;
        if (msg.source === "ai") {
          const content = msg.message || JSON.stringify(msg);
          setMessages(prev => [...prev, {
            role: "interviewer",
            content,
            timestamp: new Date().toLocaleTimeString(),
          }]);
          
          // Update stats when interviewer asks a question
          if (content.includes("?")) {
            setInterviewStats(prev => ({ ...prev, totalQuestions: prev.totalQuestions + 1 }));
          }
        } else if (msg.source === "user") {
          const content = msg.message || JSON.stringify(msg);
          setMessages(prev => [...prev, {
            role: "candidate",
            content,
            timestamp: new Date().toLocaleTimeString(),
          }]);
          
          // Analyze candidate response in real-time
          analyzeResponse(content);
        }
      }
    },
    onError: (error) => {
      console.error("ElevenLabs error:", error);
      toast({
        title: "Error",
        description: "An error occurred during the interview",
        variant: "destructive",
      });
    },
  });

  const startInterview = async () => {
    if (isProcessingAction) {
      console.log("Action already in progress, ignoring");
      return;
    }
    
    try {
      setIsProcessingAction(true);
      
      // Only request media if not reconnecting (already have permissions)
      if (!isReconnecting) {
        // Request microphone access
        await navigator.mediaDevices.getUserMedia({ audio: true });

        // Request camera for video
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
        
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }

      // Get signed URL from edge function
      const { data, error } = await supabase.functions.invoke("realtime-interview");
      
      if (error || !data?.signed_url) {
        throw new Error("Failed to get signed URL");
      }

      console.log("Starting conversation with signed URL");
      const conversationId = await conversation.startSession({
        signedUrl: data.signed_url,
      });

      console.log("Conversation started:", conversationId);
      
      // Reset reconnect attempts on successful connection
      if (isReconnecting) {
        setReconnectAttempts(0);
        setIsReconnecting(false);
        toast({
          title: "Reconnected!",
          description: "Interview connection restored successfully.",
        });
      }
      
      // Allow actions again after successful connection
      setTimeout(() => setIsProcessingAction(false), 1000);
    } catch (error: any) {
      console.error("Error starting interview:", error);
      setIsProcessingAction(false);
      
      if (isReconnecting && reconnectAttempts < maxReconnectAttempts) {
        // Retry if we're in reconnection mode
        console.log("Reconnection failed, will retry...");
        setTimeout(() => startInterview(), 2000);
      } else {
        setIsReconnecting(false);
        toast({
          title: "Error",
          description: error.message || "Failed to start interview",
          variant: "destructive",
        });
      }
    }
  };

  const analyzeResponse = (response: string) => {
    const wordCount = response.split(/\s+/).length;
    
    // Update stats
    setInterviewStats(prev => ({
      ...prev,
      answersGiven: prev.answersGiven + 1,
      avgResponseLength: Math.round((prev.avgResponseLength * prev.answersGiven + wordCount) / (prev.answersGiven + 1)),
    }));
    
    // Base score increase per answer (5-10 points)
    const baseIncrease = Math.floor(Math.random() * 6) + 5; // Random 5-10
    
    // Update momentum and performance based on response quality
    if (wordCount > 50) {
      // Good detailed response - higher increase
      setCurrentMomentum(prev => Math.min(100, prev + baseIncrease + 3));
      setPerformance(prev => Math.min(100, prev + baseIncrease + 2));
    } else if (wordCount > 20) {
      // Moderate response
      setCurrentMomentum(prev => Math.min(100, prev + baseIncrease));
      setPerformance(prev => Math.min(100, prev + baseIncrease - 1));
    } else {
      // Short response - smaller increase
      setCurrentMomentum(prev => Math.min(100, prev + Math.max(3, baseIncrease - 3)));
      setPerformance(prev => Math.min(100, prev + Math.max(2, baseIncrease - 4)));
    }
    
    // Check for technical terms - bonus points
    const technicalTerms = ["algorithm", "optimize", "implement", "architecture", "database", "API", "framework", "testing", "deployment", "scalable", "performance", "security", "design", "pattern", "async", "function", "component"];
    const hasTechnicalContent = technicalTerms.some(term => response.toLowerCase().includes(term));
    
    if (hasTechnicalContent) {
      setInterviewStats(prev => ({ ...prev, technicalDepth: Math.min(100, prev.technicalDepth + 8) }));
      setPerformance(prev => Math.min(100, prev + 3));
    }
    
    // Check communication clarity - bonus points
    const hasStructure = response.includes("first") || response.includes("second") || response.includes("because") || response.includes("therefore") || response.includes("example");
    if (hasStructure) {
      setInterviewStats(prev => ({ ...prev, communicationClarity: Math.min(100, prev.communicationClarity + 6) }));
      setCurrentMomentum(prev => Math.min(100, prev + 2));
    }
    
    // Generate insights
    if (wordCount > 80 && hasTechnicalContent) {
      setFeedbackInsights(prev => [...prev, {
        type: "strength",
        content: "Excellent detailed response with technical depth",
        timestamp: new Date().toLocaleTimeString(),
      }]);
    } else if (wordCount < 25) {
      setFeedbackInsights(prev => [...prev, {
        type: "improvement",
        content: "Try to provide more detailed explanations",
        timestamp: new Date().toLocaleTimeString(),
      }]);
    }
  };

  const stopInterview = async () => {
    if (isProcessingAction) {
      console.log("Action already in progress, ignoring");
      return;
    }
    
    console.log("Manually stopping interview");
    setIsProcessingAction(true);
    wasManualDisconnectRef.current = true; // Mark as intentional using ref to avoid race condition
    setReconnectAttempts(0); // Reset reconnect attempts
    setIsReconnecting(false);
    
    try {
      await conversation.endSession();
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Show feedback modal
      setShowFeedback(true);
      
      toast({
        title: "Interview Ended",
        description: "Thank you for practicing!",
      });
      
      // Prevent immediate restart from double-clicks
      setTimeout(() => setIsProcessingAction(false), 2000);
    } catch (error) {
      console.error("Error stopping interview:", error);
      setIsProcessingAction(false);
    }
  };

  useEffect(() => {
    return () => {
      // Only cleanup media streams on unmount, don't end the session
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return (
    <>
      {showFeedback && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Interview Feedback Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{interviewStats.totalQuestions}</div>
                <div className="text-xs text-muted-foreground">Questions Asked</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{interviewStats.answersGiven}</div>
                <div className="text-xs text-muted-foreground">Answers Given</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{interviewStats.avgResponseLength}</div>
                <div className="text-xs text-muted-foreground">Avg Words/Answer</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-success">{performance}/100</div>
                <div className="text-xs text-muted-foreground">Overall Score</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Technical Depth</span>
                  <span className="font-medium">{interviewStats.technicalDepth}/100</span>
                </div>
                <Progress value={interviewStats.technicalDepth} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Communication Clarity</span>
                  <span className="font-medium">{interviewStats.communicationClarity}/100</span>
                </div>
                <Progress value={interviewStats.communicationClarity} className="h-2" />
              </div>
            </div>

            <div className="space-y-3 mt-4">
              <h4 className="font-semibold text-sm">Key Insights</h4>
              {feedbackInsights.length > 0 ? (
                feedbackInsights.map((insight, idx) => (
                  <div key={idx} className={`p-3 rounded-lg border ${
                    insight.type === "strength" ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800" :
                    insight.type === "improvement" ? "bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800" :
                    "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800"
                  }`}>
                    <Badge variant={insight.type === "strength" ? "default" : "secondary"} className="mb-1">
                      {insight.type === "strength" ? "✓ Strength" : insight.type === "improvement" ? "→ Improvement" : "💡 Tip"}
                    </Badge>
                    <p className="text-sm mt-1">{insight.content}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Complete the interview to receive detailed feedback</p>
              )}
            </div>

            <Button onClick={() => setShowFeedback(false)} className="w-full">
              Close Feedback
            </Button>
          </CardContent>
        </Card>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[600px]">
      {/* Video Section */}
      <Card className="relative overflow-hidden">
        <CardContent className="p-0 h-full">
          <div className="relative h-full bg-gradient-to-br from-gray-900 to-gray-800">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${videoEnabled ? '' : 'hidden'}`}
            />
            {!videoEnabled && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
                  <VideoOff className="w-12 h-12 text-white" />
                </div>
              </div>
            )}
            
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <Badge variant={conversation.status === "connected" ? "default" : "secondary"} className="gap-2">
                <div className={`w-2 h-2 rounded-full ${conversation.status === "connected" ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                {conversation.status === "connected" ? "Connected" : "Disconnected"}
              </Badge>
              {conversation.isSpeaking && (
                <Badge variant="outline" className="bg-white/10 backdrop-blur">
                  AI Speaking...
                </Badge>
              )}
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {conversation.status !== "connected" ? (
                <Button
                  onClick={startInterview}
                  disabled={conversation.status === "connecting" || isProcessingAction}
                  className="bg-primary hover:bg-primary/90"
                >
                  {conversation.status === "connecting" || isProcessingAction ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    "Start Interview"
                  )}
                </Button>
              ) : (
                <>
                  <Button
                    variant={videoEnabled ? "default" : "secondary"}
                    size="icon"
                    onClick={() => setVideoEnabled(!videoEnabled)}
                  >
                    {videoEnabled ? <Video /> : <VideoOff />}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={stopInterview}
                    disabled={isProcessingAction}
                  >
                    {isProcessingAction ? "Ending..." : "End Interview"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transcript & Analysis Section */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Real-time Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Current Momentum</span>
                  <span className="font-bold text-primary">{currentMomentum}/100</span>
                </div>
                <Progress value={currentMomentum} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Performance</span>
                  <span className="font-bold text-success">{performance}/100</span>
                </div>
                <Progress value={performance} className="h-2" />
              </div>
            </div>
            <div className="pt-2 border-t">
              <p className="text-sm font-medium mb-2">Next Focus</p>
              <p className="text-sm text-primary">Provide specific examples and quantify achievements</p>
            </div>
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="text-lg">Interview Transcript</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[350px] pr-4">
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Start the interview to see the live transcript
                  </p>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={index}
                      className={`space-y-1 ${message.highlighted ? 'bg-primary/5 p-2 rounded border-l-2 border-primary' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant={message.role === "interviewer" ? "default" : "secondary"} className="text-xs">
                          {message.role === "interviewer" ? "Interviewer" : "You"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{message.timestamp}</span>
                      </div>
                      <p className="text-sm">{message.content}</p>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
};

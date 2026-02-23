import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Clock, CheckCircle, XCircle, BookOpen } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const JOB_ROLES = [
  "Software Developer",
  "Data Scientist",
  "Web Developer",
  "DevOps Engineer",
  "Product Manager",
  "UI/UX Designer",
  "Business Analyst",
  "Marketing Manager",
  "Sales Executive",
  "General Aptitude"
];

interface Question {
  question: string;
  options: string[];
  correct_answer?: string;
  correctAnswer?: number;
  type: string;
  difficulty?: string;
}

interface TeacherTest {
  id: string;
  title: string;
  category: string;
  duration_minutes: number;
  questions: Question[];
}

const MockTest = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stage, setStage] = useState<"select" | "test" | "results">("select");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [teacherTests, setTeacherTests] = useState<TeacherTest[]>([]);
  const [selectedTest, setSelectedTest] = useState<TeacherTest | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [correctCount, setCorrectCount] = useState(0);
  const [currentDifficulty, setCurrentDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [timeLeft, setTimeLeft] = useState(30);
  const [answers, setAnswers] = useState<Array<{ question: string; userAnswer: string; correctAnswer: string; isCorrect: boolean }>>([]);

  useEffect(() => {
    fetchTeacherTests();
  }, []);

  const fetchTeacherTests = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all mock tests
      const { data: allTests, error: testsError } = await supabase
        .from('mock_tests')
        .select('*')
        .order('created_at', { ascending: false });

      if (testsError) throw testsError;

      // Fetch tests already completed by this student
      const { data: completedResults, error: resultsError } = await supabase
        .from('mock_results')
        .select('test_id')
        .eq('student_id', user.id);

      if (resultsError) throw resultsError;

      // Get list of completed test IDs
      const completedTestIds = new Set(completedResults?.map(r => r.test_id) || []);

      // Filter out completed tests
      const availableTests = allTests?.filter(test => !completedTestIds.has(test.id)) || [];

      setTeacherTests(availableTests.map(test => ({
        ...test,
        questions: test.questions as any as Question[]
      })));
    } catch (error: any) {
      console.error("Fetch tests error:", error);
    }
  };

  const handleNextQuestion = () => {
    const currentQuestion = questions[currentQuestionIndex];
    let isCorrect = false;
    let correctAnswer = "";

    // Handle both teacher tests and AI-generated tests
    if (currentQuestion.correctAnswer !== undefined) {
      // Teacher test format
      correctAnswer = currentQuestion.options[currentQuestion.correctAnswer];
      isCorrect = selectedAnswer === correctAnswer;
    } else if (currentQuestion.correct_answer) {
      // AI-generated test format
      correctAnswer = currentQuestion.correct_answer;
      isCorrect = selectedAnswer === correctAnswer;
    }
    
    if (selectedAnswer) {
      const newAnswers = [...answers, {
        question: currentQuestion.question,
        userAnswer: selectedAnswer,
        correctAnswer: correctAnswer,
        isCorrect
      }];
      setAnswers(newAnswers);

      if (isCorrect) {
        setCorrectCount(correctCount + 1);
      }

      // Adjust difficulty only for AI tests
      if (!selectedTest) {
        adjustDifficulty(isCorrect);
      }

      // If this is the last question, save results and show results page
      if (currentQuestionIndex >= questions.length - 1) {
        const finalCorrectCount = isCorrect ? correctCount + 1 : correctCount;
        saveTestResults(finalCorrectCount, newAnswers);
        setStage("results");
      } else {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setSelectedAnswer("");
      }
    } else {
      // Move to next question without saving answer
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setSelectedAnswer("");
      } else {
        saveTestResults(correctCount, answers);
        setStage("results");
      }
    }
  };

  const saveTestResults = async (finalCorrectCount: number, finalAnswers: typeof answers) => {
    // Only save results for teacher-created tests
    if (!selectedTest) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const score = (finalCorrectCount / questions.length) * 100;
      
      const { error } = await supabase
        .from('mock_results')
        .insert({
          student_id: user.id,
          test_id: selectedTest.id,
          score: score,
          answers: finalAnswers,
          duration_sec: selectedTest.duration_minutes * 60 - timeLeft
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Test results saved successfully!",
      });
    } catch (error: any) {
      console.error("Save results error:", error);
      toast({
        title: "Error",
        description: "Failed to save test results",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (stage === "test" && questions.length > 0) {
      const initialTime = selectedTest ? selectedTest.duration_minutes * 60 : 30;
      setTimeLeft(initialTime);
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleNextQuestion();
            return initialTime;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [currentQuestionIndex, stage, questions.length]);

  const startTeacherTest = (test: TeacherTest) => {
    setSelectedTest(test);
    setQuestions(test.questions);
    setTimeLeft(test.duration_minutes * 60);
    setCorrectCount(0);
    setAnswers([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswer("");
    setStage("test");
  };

  const startTest = async () => {
    if (!selectedRole) {
      toast({
        title: "Error",
        description: "Please select a job role",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Reset test state
      setCorrectCount(0);
      setAnswers([]);
      setCurrentQuestionIndex(0);
      setSelectedAnswer("");
      setCurrentDifficulty("medium");
      
      // Generate questions
      const { data: questionsData, error: questionsError } = await supabase.functions.invoke(
        "generate-test-questions",
        {
          body: { 
            jobRole: selectedRole, 
            difficulty: currentDifficulty,
            count: 10
          },
        }
      );

      if (questionsError) throw questionsError;
      if (!questionsData?.questions) throw new Error("Failed to generate questions");

      setQuestions(questionsData.questions);
      setStage("test");
    } catch (error: any) {
      console.error("Start test error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to start test",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const adjustDifficulty = (isCorrect: boolean) => {
    if (isCorrect && currentDifficulty === "easy") {
      setCurrentDifficulty("medium");
    } else if (isCorrect && currentDifficulty === "medium") {
      setCurrentDifficulty("hard");
    } else if (!isCorrect && currentDifficulty === "hard") {
      setCurrentDifficulty("medium");
    } else if (!isCorrect && currentDifficulty === "medium") {
      setCurrentDifficulty("easy");
    }
  };

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="container mx-auto max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard/student")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        {stage === "select" && (
          <div className="space-y-6">
            {teacherTests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Teacher-Created Tests
                  </CardTitle>
                  <CardDescription>
                    Complete tests assigned by your teachers
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {teacherTests.map((test) => (
                    <Card key={test.id} className="border-2 hover:border-primary/50 transition-colors">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <h3 className="font-semibold text-lg">{test.title}</h3>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="secondary">{test.category}</Badge>
                              <Badge variant="outline">
                                {test.questions.length} Questions
                              </Badge>
                              <Badge variant="outline">
                                <Clock className="h-3 w-3 mr-1" />
                                {test.duration_minutes} mins
                              </Badge>
                            </div>
                          </div>
                          <Button onClick={() => startTeacherTest(test)}>
                            Start Test
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            )}

            {teacherTests.length === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>AI-Generated Mock Test</CardTitle>
                  <CardDescription>
                    No teacher tests available. Choose a job role for AI-generated questions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Job Role</Label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a job role" />
                      </SelectTrigger>
                      <SelectContent>
                        {JOB_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <h3 className="font-semibold">Test Features:</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      <li>10 questions tailored to your selected role</li>
                      <li>Mix of technical and aptitude questions</li>
                      <li>Adaptive difficulty based on your performance</li>
                      <li>30 seconds per question</li>
                      <li>Detailed results and explanations</li>
                    </ul>
                  </div>

                  <Button
                    onClick={startTest}
                    disabled={!selectedRole || loading}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating Questions...
                      </>
                    ) : (
                      "Start Mock Test"
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {stage === "test" && currentQuestion && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-muted-foreground">
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4" />
                    <span className={timeLeft <= 10 ? "text-destructive font-bold" : ""}>
                      {selectedTest ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}` : `${timeLeft}s`}
                    </span>
                  </div>
                </div>
                <Progress value={progress} className="h-2" />
                {!selectedTest && (
                  <div className="text-xs text-muted-foreground">
                    Difficulty: <span className="font-semibold capitalize">{currentDifficulty}</span>
                  </div>
                )}
                {selectedTest && (
                  <div className="text-xs text-muted-foreground">
                    Test: <span className="font-semibold">{selectedTest.title}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{currentQuestion.question}</CardTitle>
                {currentQuestion.difficulty && (
                  <CardDescription className="text-xs capitalize">
                    {currentQuestion.type} • {currentQuestion.difficulty}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup value={selectedAnswer} onValueChange={setSelectedAnswer}>
                  {currentQuestion.options.map((option, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <RadioGroupItem value={option} id={`option-${index}`} />
                      <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>

                <Button
                  onClick={handleNextQuestion}
                  disabled={!selectedAnswer}
                  className="w-full"
                >
                  {currentQuestionIndex < questions.length - 1 ? "Next Question" : "Finish Test"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {stage === "results" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Test Results</CardTitle>
                <CardDescription>Your performance summary</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center space-y-2">
                  <div className="text-5xl font-bold text-primary">
                    {Math.round((correctCount / questions.length) * 100)}%
                  </div>
                  <div className="text-muted-foreground">
                    {correctCount} out of {questions.length} correct
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-primary/10 p-4 rounded-lg text-center">
                    <div className="flex items-center justify-center gap-2 text-primary mb-1">
                      <CheckCircle className="h-5 w-5" />
                      <span className="text-2xl font-bold">{correctCount}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">Correct</div>
                  </div>
                  <div className="bg-destructive/10 p-4 rounded-lg text-center">
                    <div className="flex items-center justify-center gap-2 text-destructive mb-1">
                      <XCircle className="h-5 w-5" />
                      <span className="text-2xl font-bold">{questions.length - correctCount}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">Incorrect</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">Answer Review:</h3>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {answers.map((answer, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border ${
                          answer.isCorrect
                            ? "bg-primary/5 border-primary/20"
                            : "bg-destructive/5 border-destructive/20"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {answer.isCorrect ? (
                            <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                          ) : (
                            <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                          )}
                          <div className="flex-1 space-y-1">
                            <div className="font-medium text-sm">{answer.question}</div>
                            <div className="text-xs space-y-0.5">
                              <div>Your answer: <span className="font-medium">{answer.userAnswer}</span></div>
                              {!answer.isCorrect && (
                                <div className="text-primary">
                                  Correct answer: <span className="font-medium">{answer.correctAnswer}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => {
                    setStage("select");
                    setCurrentQuestionIndex(0);
                    setCorrectCount(0);
                    setSelectedAnswer("");
                    setAnswers([]);
                    setSelectedRole("");
                    setSelectedTest(null);
                    fetchTeacherTests();
                  }} variant="outline" className="flex-1">
                    Take Another Test
                  </Button>
                  <Button onClick={() => navigate("/dashboard/student")} className="flex-1">
                    Back to Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default MockTest;
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Plus, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
  type: string;
}

export const TeacherTestCreator = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [duration, setDuration] = useState(30);
  const [jobRole, setJobRole] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [questionCount, setQuestionCount] = useState(10);
  const [questions, setQuestions] = useState<Question[]>([]);

  const handleGenerateQuestions = async () => {
    if (!jobRole) {
      toast({
        title: "Error",
        description: "Please enter a job role",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-test-questions', {
        body: { jobRole, difficulty, count: questionCount }
      });

      if (error) throw error;

      if (data?.questions) {
        setQuestions(data.questions);
        setTitle(`${jobRole} - ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Level Test`);
        setCategory(jobRole);
        toast({
          title: "Success",
          description: `Generated ${data.questions.length} questions`,
        });
      }
    } catch (error: any) {
      console.error("Generation error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate questions",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleAddQuestion = () => {
    setQuestions([...questions, {
      question: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
      type: "multiple-choice"
    }]);
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (index: number, field: string, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const handleOptionChange = (qIndex: number, oIndex: number, value: string) => {
    const updated = [...questions];
    updated[qIndex].options[oIndex] = value;
    setQuestions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (questions.length === 0) {
        throw new Error("Please add at least one question");
      }

      const { error } = await supabase
        .from('mock_tests')
        .insert([{
          title,
          category,
          duration_minutes: duration,
          questions: questions as any,
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Test created successfully",
      });

      // Reset form
      setTitle("");
      setCategory("");
      setDuration(30);
      setJobRole("");
      setQuestions([]);
    } catch (error: any) {
      console.error("Create test error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create test",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Test Generator</CardTitle>
          <CardDescription>Generate questions using AI based on job role and difficulty</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="job-role">Job Role</Label>
              <Input
                id="job-role"
                value={jobRole}
                onChange={(e) => setJobRole(e.target.value)}
                placeholder="e.g., Software Engineer"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select value={difficulty} onValueChange={(value: any) => setDifficulty(value)}>
                <SelectTrigger id="difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="question-count">Number of Questions</Label>
              <Input
                id="question-count"
                type="number"
                min="5"
                max="20"
                value={questionCount}
                onChange={(e) => setQuestionCount(parseInt(e.target.value))}
              />
            </div>
          </div>

          <Button 
            onClick={handleGenerateQuestions} 
            disabled={generating}
            className="w-full"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Questions...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Questions with AI
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test Details</CardTitle>
          <CardDescription>Configure test settings and review questions</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Test Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter test title"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g., Technical, Aptitude"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="10"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  required
                />
              </div>
            </div>

            {questions.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Questions ({questions.length})</Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddQuestion}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Question
                  </Button>
                </div>

                {questions.map((q, qIndex) => (
                  <Card key={qIndex}>
                    <CardContent className="pt-6 space-y-3">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 space-y-2">
                          <Label>Question {qIndex + 1}</Label>
                          <Textarea
                            value={q.question}
                            onChange={(e) => handleQuestionChange(qIndex, 'question', e.target.value)}
                            placeholder="Enter question"
                            rows={2}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveQuestion(qIndex)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label>Options</Label>
                        {q.options.map((option, oIndex) => (
                          <div key={oIndex} className="flex items-center gap-2">
                            <Input
                              value={option}
                              onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                              placeholder={`Option ${oIndex + 1}`}
                            />
                            <input
                              type="radio"
                              name={`correct-${qIndex}`}
                              checked={q.correctAnswer === oIndex}
                              onChange={() => handleQuestionChange(qIndex, 'correctAnswer', oIndex)}
                              className="h-4 w-4"
                            />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Button type="submit" disabled={loading || questions.length === 0} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Test...
                </>
              ) : (
                "Create Test"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

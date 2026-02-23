import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, Pencil, Trash2, Send } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Feedback {
  id: string;
  student_id: string;
  feedback_text: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
  profiles: {
    name: string;
    department: string;
    batch: string;
  };
}

export const FeedbackWall = () => {
  const { toast } = useToast();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newFeedback, setNewFeedback] = useState("");
  const [category, setCategory] = useState("suggestions");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [editingFeedback, setEditingFeedback] = useState<Feedback | null>(null);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    loadFeedbacks();
    getCurrentUser();
    setupRealtimeSubscription();
  }, []);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('feedback-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'feedback'
        },
        () => {
          loadFeedbacks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const loadFeedbacks = async () => {
    try {
      const { data, error } = await supabase
        .from("feedback")
        .select(`
          *,
          profiles (
            name,
            department,
            batch
          )
        `)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Filter will be handled by RLS policy
      // Issues category will only be visible to TPO/Teachers
      setFeedbacks(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load feedback",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!newFeedback.trim()) {
      toast({
        title: "Error",
        description: "Please enter your feedback",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("feedback")
        .insert({
          student_id: user?.id,
          feedback_text: newFeedback,
          category: category,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Your feedback has been submitted!",
      });
      setNewFeedback("");
      setCategory("suggestions");
      loadFeedbacks();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editText.trim() || !editingFeedback) return;

    try {
      const { error } = await supabase
        .from("feedback")
        .update({ 
          feedback_text: editText,
          updated_at: new Date().toISOString()
        })
        .eq("id", editingFeedback.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Feedback updated successfully",
      });
      setEditingFeedback(null);
      setEditText("");
      loadFeedbacks();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("feedback")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Feedback deleted successfully",
      });
      loadFeedbacks();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      interview_experience: "Interview Experience",
      company_feedback: "Company Feedback",
      suggestions: "Suggestions",
      issues: "Issues",
      other: "Other"
    };
    return labels[cat] || cat;
  };

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      interview_experience: "bg-blue-500/10 text-blue-500",
      company_feedback: "bg-green-500/10 text-green-500",
      suggestions: "bg-purple-500/10 text-purple-500",
      issues: "bg-red-500/10 text-red-500",
      other: "bg-gray-500/10 text-gray-500"
    };
    return colors[cat] || colors.other;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Submit Feedback Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Share Your Feedback
          </CardTitle>
          <CardDescription>
            Help improve the placement process by sharing your experiences and suggestions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="interview_experience">Interview Experience</SelectItem>
                <SelectItem value="company_feedback">Company Feedback</SelectItem>
                <SelectItem value="suggestions">Suggestions</SelectItem>
                <SelectItem value="issues">
                  Issues (Private - Only visible to TPO/Teachers)
                </SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {category === "issues" 
                ? "⚠️ This will only be visible to TPO and Teachers" 
                : "This will be visible to all students"}
            </p>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">Your Feedback</label>
            <Textarea
              value={newFeedback}
              onChange={(e) => setNewFeedback(e.target.value)}
              placeholder="Share your experience, suggestions, or report issues..."
              rows={4}
            />
          </div>

          <Button onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Feedback
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Feedback Wall */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Community Feedback ({feedbacks.length})</h3>
        
        {feedbacks.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No feedback yet. Be the first to share your experience!
            </CardContent>
          </Card>
        ) : (
          feedbacks.map((feedback) => (
            <Card key={feedback.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getCategoryColor(feedback.category)}>
                        {getCategoryLabel(feedback.category)}
                      </Badge>
                      {feedback.category === 'issues' && (
                        <Badge variant="outline" className="text-xs">
                          🔒 Private
                        </Badge>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(feedback.created_at), "PPp")}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">{feedback.profiles.name}</span>
                      <span className="text-muted-foreground">
                        {" • "}
                        {feedback.profiles.department}
                        {" • "}
                        {feedback.profiles.batch}
                      </span>
                    </div>
                  </div>
                  
                  {currentUser?.id === feedback.student_id && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingFeedback(feedback);
                          setEditText(feedback.feedback_text);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(feedback.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{feedback.feedback_text}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingFeedback} onOpenChange={() => setEditingFeedback(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Feedback</DialogTitle>
            <DialogDescription>Update your feedback below</DialogDescription>
          </DialogHeader>
          <Textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={6}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFeedback(null)}>
              Cancel
            </Button>
            <Button onClick={handleEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

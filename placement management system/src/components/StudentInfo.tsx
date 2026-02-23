import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Edit2, Save, X, User, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export const StudentInfo = () => {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [editedData, setEditedData] = useState({
    tenthPercentage: "",
    twelfthPercentage: "",
    cgpa: "",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error) throw error;

      setProfile(data);
      setEditedData({
        tenthPercentage: data.tenth_percentage?.toString() || "",
        twelfthPercentage: data.twelfth_percentage?.toString() || "",
        cgpa: data.cgpa?.toString() || "",
      });
    } catch (error: any) {
      console.error("Error fetching profile:", error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          tenth_percentage: parseFloat(editedData.tenthPercentage),
          twelfth_percentage: parseFloat(editedData.twelfthPercentage),
          cgpa: parseFloat(editedData.cgpa),
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Your academic details have been updated",
      });

      setIsEditing(false);
      fetchProfile();
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: "Failed to update details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditedData({
      tenthPercentage: profile.tenth_percentage?.toString() || "",
      twelfthPercentage: profile.twelfth_percentage?.toString() || "",
      cgpa: profile.cgpa?.toString() || "",
    });
    setIsEditing(false);
  };

  if (!profile) return null;

  return (
    <Card className="w-full">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <User className="h-5 w-5" />
            <CardTitle className="text-lg">Academic Details</CardTitle>
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          {isOpen && (
            !isEditing ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  disabled={loading}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSave}
                  disabled={loading}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            )
          )}
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <div className="text-sm font-medium">{profile.name}</div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="text-sm font-medium">{profile.email}</div>
            </div>

            {profile.department && (
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <div className="text-sm font-medium">{profile.department}</div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="tenth">10th Percentage</Label>
              {isEditing ? (
                <Input
                  id="tenth"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={editedData.tenthPercentage}
                  onChange={(e) => setEditedData({ ...editedData, tenthPercentage: e.target.value })}
                />
              ) : (
                <div className="text-sm font-medium">
                  {profile.tenth_percentage ? `${profile.tenth_percentage}%` : "Not set"}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="twelfth">12th Percentage</Label>
              {isEditing ? (
                <Input
                  id="twelfth"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={editedData.twelfthPercentage}
                  onChange={(e) => setEditedData({ ...editedData, twelfthPercentage: e.target.value })}
                />
              ) : (
                <div className="text-sm font-medium">
                  {profile.twelfth_percentage ? `${profile.twelfth_percentage}%` : "Not set"}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cgpa">CGPA</Label>
              {isEditing ? (
                <Input
                  id="cgpa"
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  value={editedData.cgpa}
                  onChange={(e) => setEditedData({ ...editedData, cgpa: e.target.value })}
                />
              ) : (
                <div className="text-sm font-medium">
                  {profile.cgpa ? `${profile.cgpa}/10` : "Not set"}
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
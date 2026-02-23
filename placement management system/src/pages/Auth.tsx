import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, GraduationCap, Building2, BookOpen, ArrowLeft } from "lucide-react";

const Auth = () => {
  const { role } = useParams();
  const roleParam = role || "student";
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    department: "",
    tenthPercentage: "",
    twelfthPercentage: "",
    cgpa: "",
  });

  const roleConfig = {
    student: {
      icon: GraduationCap,
      title: "Student",
      gradient: "from-primary to-primary-glow"
    },
    tpo: {
      icon: Building2,
      title: "TPO",
      gradient: "from-secondary to-purple-500"
    },
    teacher: {
      icon: BookOpen,
      title: "Teacher",
      gradient: "from-success to-emerald-500"
    }
  };

  const config = roleConfig[roleParam as keyof typeof roleConfig] || roleConfig.student;

  useEffect(() => {
    // Redirect to student role if invalid role
    if (!roleConfig[roleParam as keyof typeof roleConfig]) {
      navigate("/auth/student", { replace: true });
      return;
    }
    
    // Check if user is already logged in
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // Check user's actual role
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id);

        if (roles && roles.length > 0) {
          // Redirect to their actual dashboard
          navigate(`/dashboard/${roles[0].role}`);
        }
      }
    });
  }, []);

  const redirectToDashboard = (role: string) => {
    navigate(`/dashboard/${role}`);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isForgotPassword) {
        // Send OTP for password reset
        console.log("Sending password reset OTP to:", formData.email);
        const { data: otpData, error: otpError } = await supabase.functions.invoke("send-otp", {
          body: { email: formData.email, purpose: "reset" },
        });

        console.log("OTP Response:", { data: otpData, error: otpError });

        // Check for errors
        if (otpError) {
          console.error("OTP invocation error:", otpError);
          throw new Error(otpError.message || "Failed to send reset code. Please try again.");
        }
        
        if (otpData?.error) {
          console.error("OTP data contains error:", otpData.error);
          throw new Error(otpData.error);
        }

        if (!otpData?.success) {
          throw new Error("Failed to send reset code. Please try again.");
        }

        toast({
          title: "Reset Code Sent",
          description: "Please check your email for the password reset code.",
        });

        // Navigate to OTP verification page
        navigate("/verify-otp", {
          state: { 
            email: formData.email,
            purpose: "reset",
            role: roleParam
          },
        });
      } else if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) throw error;

        if (data.session) {
          // Check if user has the role
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", data.session.user.id)
            .eq("role", roleParam as "student" | "tpo" | "teacher")
            .maybeSingle();

          if (!roles) {
            await supabase.auth.signOut();
            throw new Error(`You don't have ${config.title} access`);
          }

          // Check if temp password needs to be changed
          const { data: profile } = await supabase
            .from("profiles")
            .select("temp_password_used")
            .eq("id", data.session.user.id)
            .single();

          if (profile && profile.temp_password_used === false) {
            navigate(`/change-password?first=true`);
            return;
          }

          toast({
            title: "Welcome back!",
            description: "Login successful",
          });

          redirectToDashboard(roles.role);
        }
      } else {
        // Sign up with OTP verification
        // Send OTP to email
        const { data: otpData, error: otpError } = await supabase.functions.invoke("send-otp", {
          body: { email: formData.email, name: formData.name, role: roleParam },
        });

        if (otpError) {
          console.error("OTP Error:", otpError);
          throw new Error(otpError.message || "Failed to send verification code");
        }
        
        if (otpData?.error) {
          console.error("OTP Data Error:", otpData.error);
          // Check if it's a pre-registration error
          if (otpData.code === "EMAIL_NOT_PREREGISTERED") {
            throw new Error(otpData.error);
          }
          throw new Error(otpData.error);
        }

        toast({
          title: "Verification Code Sent",
          description: "Please check your email for the verification code.",
        });

        // Navigate to OTP verification page
        navigate("/verify-otp", {
          state: { 
            email: formData.email, 
            name: formData.name, 
            department: roleParam !== "tpo" ? formData.department : undefined,
            tenthPercentage: roleParam === "student" ? parseFloat(formData.tenthPercentage) : undefined,
            twelfthPercentage: roleParam === "student" ? parseFloat(formData.twelfthPercentage) : undefined,
            cgpa: roleParam === "student" ? parseFloat(formData.cgpa) : undefined,
            role: roleParam 
          },
        });
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 bg-gradient-card shadow-glow">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="text-center mb-8">
          <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-glow`}>
            <config.icon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">{config.title} Portal</h1>
          <p className="text-muted-foreground">
            {isForgotPassword ? "Reset your password" : isLogin ? "Sign in to your account" : "Create your account"}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && !isForgotPassword && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              {roleParam !== "tpo" && (
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Select
                    value={formData.department}
                    onValueChange={(value) => setFormData({ ...formData, department: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CSE">CSE</SelectItem>
                      <SelectItem value="ISE">ISE</SelectItem>
                      <SelectItem value="EC">EC</SelectItem>
                      <SelectItem value="ME">ME</SelectItem>
                      <SelectItem value="CV">CV</SelectItem>
                      <SelectItem value="AG">AG</SelectItem>
                      <SelectItem value="CSE(DS)">CSE(DS)</SelectItem>
                      <SelectItem value="CSD">CSD</SelectItem>
                      <SelectItem value="CSE(IOT)">CSE(IOT)</SelectItem>
                      <SelectItem value="AIML">AIML</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {roleParam === "student" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="tenthPercentage">10th Percentage</Label>
                    <Input
                      id="tenthPercentage"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="85.5"
                      required
                      value={formData.tenthPercentage}
                      onChange={(e) => setFormData({ ...formData, tenthPercentage: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="twelfthPercentage">12th Percentage</Label>
                    <Input
                      id="twelfthPercentage"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="90.0"
                      required
                      value={formData.twelfthPercentage}
                      onChange={(e) => setFormData({ ...formData, twelfthPercentage: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cgpa">Current CGPA</Label>
                    <Input
                      id="cgpa"
                      type="number"
                      step="0.01"
                      min="0"
                      max="10"
                      placeholder="8.5"
                      required
                      value={formData.cgpa}
                      onChange={(e) => setFormData({ ...formData, cgpa: e.target.value })}
                    />
                  </div>
                </>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          {isLogin && !isForgotPassword && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <Button
            type="submit"
            className={`w-full bg-gradient-to-br ${config.gradient} hover:opacity-90 text-white font-semibold`}
            disabled={loading}
          >
            {loading ? "Processing..." : isForgotPassword ? "Send Reset Code" : isLogin ? "Sign In" : "Sign Up"}
          </Button>
        </form>

        <div className="mt-6 space-y-2 text-center">
          {isLogin && !isForgotPassword && (
            <button
              onClick={() => setIsForgotPassword(true)}
              className="text-sm text-primary hover:underline block w-full"
            >
              Forgot Password?
            </button>
          )}
          {/* TPO has fixed credentials - no signup allowed */}
          {roleParam !== "tpo" && (
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setIsForgotPassword(false);
              }}
              className="text-sm text-primary hover:underline"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          )}
          {roleParam === "tpo" && isLogin && !isForgotPassword && (
            <p className="text-xs text-muted-foreground">
              Contact system administrator for TPO access
            </p>
          )}
          {isForgotPassword && (
            <button
              onClick={() => setIsForgotPassword(false)}
              className="text-sm text-muted-foreground hover:underline"
            >
              Back to Sign In
            </button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Auth;

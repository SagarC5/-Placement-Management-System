import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const VerifyOTP = () => {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const email = location.state?.email;
  const name = location.state?.name;
  const department = location.state?.department;
  const role = location.state?.role;
  const purpose = location.state?.purpose || "signup";
  const tenthPercentage = location.state?.tenthPercentage;
  const twelfthPercentage = location.state?.twelfthPercentage;
  const cgpa = location.state?.cgpa;

  if (!email) {
    navigate("/auth/student");
    return null;
  }

  const handleVerify = async () => {
    if (otp.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter a 6-digit code",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Verify OTP
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke("verify-otp", {
        body: { 
          email, 
          otp, 
          name, 
          department, 
          role, 
          purpose,
          tenthPercentage,
          twelfthPercentage,
          cgpa
        },
      });

      if (verifyError || verifyData.error) {
        throw new Error(verifyData?.error || verifyError.message);
      }

      const tempPassword = verifyData.tempPassword;

      if (purpose === "reset") {
        // Sign in with temp password for password reset
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: tempPassword,
        });

        if (signInError) throw signInError;

        toast({
          title: "Success!",
          description: "Please set your new password.",
        });

        // Redirect to change password
        navigate("/change-password?reset=true");
      } else {
        // User account was created by the edge function, now sign in with temp password
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: tempPassword,
        });

        if (signInError) throw signInError;

        toast({
          title: "Success!",
          description: "Account created. Please set your password.",
        });

        // Redirect to change password
        navigate("/change-password?setup=true");
      }
    } catch (error: any) {
      console.error("Verification error:", error);
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { email, name, purpose },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Code Resent",
        description: "A new verification code has been sent to your email.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to resend",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{purpose === "reset" ? "Reset Password" : "Verify Your Email"}</CardTitle>
          <CardDescription>
            Enter the 6-digit code sent to {email}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            onClick={handleVerify}
            disabled={loading || otp.length !== 6}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              purpose === "reset" ? "Verify & Reset Password" : "Verify & Create Account"
            )}
          </Button>

          <div className="text-center">
            <Button
              variant="link"
              onClick={handleResend}
              disabled={resending}
              className="text-sm"
            >
              {resending ? "Resending..." : "Resend Code"}
            </Button>
          </div>

          <div className="text-center">
            <Button
              variant="ghost"
              onClick={() => navigate(`/auth/${role}`)}
              className="text-sm"
            >
              Back to Sign Up
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyOTP;

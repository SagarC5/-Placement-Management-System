import { useNavigate } from "react-router-dom";
import { GraduationCap, Building2, BookOpen, Sparkles, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const Index = () => {
  const navigate = useNavigate();

  const loginPortals = [
    {
      role: "student",
      title: "Student Portal",
      icon: GraduationCap,
      description: "Access jobs, mock tests, and AI interview prep",
      gradient: "from-primary to-primary-glow",
      route: "/auth/student"
    },
    {
      role: "tpo",
      title: "TPO Portal",
      icon: Building2,
      description: "Manage placements, post jobs, and track applications",
      gradient: "from-secondary to-purple-500",
      route: "/auth/tpo"
    },
    {
      role: "teacher",
      title: "Teacher Portal",
      icon: BookOpen,
      description: "Monitor student progress and share resources",
      gradient: "from-success to-emerald-500",
      route: "/auth/teacher"
    }
  ];

  const features = [
    {
      icon: Sparkles,
      title: "AI-Powered ATS Scoring",
      description: "Optimize your resume with real-time AI feedback"
    },
    {
      icon: Target,
      title: "Smart Job Matching",
      description: "Get personalized job recommendations based on your skills"
    },
    {
      icon: TrendingUp,
      title: "Mock Interviews & Tests",
      description: "Practice with AI-powered interactive mock interviews"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container mx-auto px-4 py-16 relative">
          <div className="text-center max-w-4xl mx-auto mb-16 space-y-6">
            <h1 className="text-5xl md:text-7xl font-bold bg-gradient-primary bg-clip-text text-transparent animate-in slide-in-from-bottom-4 duration-1000">
              Placement Portal
            </h1>
            <div className="flex flex-wrap gap-4 justify-center animate-in slide-in-from-bottom-6 duration-1000 delay-300">
              {features.map((feature, index) => (
                <Card key={index} className="px-4 py-2 bg-card/50 backdrop-blur-sm border-primary/20 hover:border-primary/40 transition-all">
                  <div className="flex items-center gap-2">
                    <feature.icon className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">{feature.title}</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Login Portals */}
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {loginPortals.map((portal, index) => (
              <Card
                key={portal.role}
                className="group relative overflow-hidden bg-gradient-card hover:shadow-glow transition-all duration-500 cursor-pointer animate-in fade-in-50 slide-in-from-bottom-8 duration-700"
                style={{ animationDelay: `${index * 150}ms` }}
                onClick={() => navigate(portal.route)}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${portal.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />
                
                <div className="relative p-8 space-y-6">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${portal.gradient} flex items-center justify-center transform group-hover:scale-110 transition-transform duration-500 shadow-glow`}>
                    <portal.icon className="w-8 h-8 text-white" />
                  </div>
                  
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold">{portal.title}</h3>
                    <p className="text-muted-foreground">{portal.description}</p>
                  </div>

                  <Button 
                    className={`w-full bg-gradient-to-br ${portal.gradient} hover:opacity-90 text-white font-semibold shadow-soft`}
                    size="lg"
                  >
                    Access Portal
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Choose Our Platform?</h2>
          <p className="text-xl text-muted-foreground">Everything you need to succeed in your placement journey</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {features.map((feature, index) => (
            <Card key={index} className="p-6 bg-gradient-card hover:shadow-card transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Index;

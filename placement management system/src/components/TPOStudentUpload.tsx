import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, CheckCircle2, AlertCircle, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const TPOStudentUpload = () => {
  const [uploadType, setUploadType] = useState<"students" | "teachers">("students");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast({
          title: "Invalid file type",
          description: "Please upload a CSV file",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const downloadTemplate = () => {
    const template = uploadType === "students"
      ? "email,name,parent_phone,batch,department,10th %,12th %,cgpa\n4al22cd003@aiet.org.in,John Doe,9876543210,2022,CSE,85.5,90.0,8.5"
      : "email,name,phone,department\njohn.doe@aiet.org.in,Dr. John Doe,9876543210,CSE";
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = uploadType === "students" ? 'student_upload_template.csv' : 'teacher_upload_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a CSV file to upload",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      // Read file content
      const content = await file.text();

      // Call appropriate edge function based on upload type
      const functionName = uploadType === "students" ? "parse-student-csv" : "parse-teacher-csv";
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { csvContent: content },
      });

      if (error) {
        throw error;
      }

      setResult(data);
      
      const entityType = uploadType === "students" ? "students" : "teachers";
      toast({
        title: "Upload successful",
        description: `${data.uploaded} ${entityType} registered successfully`,
      });

      // Clear file input
      setFile(null);
      const fileInput = document.getElementById('csv-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
    } catch (error: any) {
      console.error("Upload error:", error);
      const entityType = uploadType === "students" ? "student list" : "teacher list";
      toast({
        title: "Upload failed",
        description: error.message || `Failed to upload ${entityType}`,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Users
        </CardTitle>
        <CardDescription>
          Upload CSV files with email addresses and details. Only pre-registered users can sign up.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={uploadType} onValueChange={(v) => {
          setUploadType(v as "students" | "teachers");
          setFile(null);
          setResult(null);
        }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="teachers">Teachers</TabsTrigger>
          </TabsList>
          
          <TabsContent value="students" className="space-y-6">
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                <strong>CSV Format Required:</strong> The file must contain at least an "email" column. 
                Optional columns: name, parent_phone, batch, department, 10th %, 12th %, cgpa
              </AlertDescription>
            </Alert>

            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={downloadTemplate}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download Student Template
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="csv-upload-students">Select CSV File</Label>
              <div className="flex gap-2">
                <Input
                  id="csv-upload-students"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
                <Button 
                  onClick={handleUpload} 
                  disabled={!file || uploading}
                  className="min-w-[100px]"
                >
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
              {file && (
                <p className="text-sm text-muted-foreground">
                  Selected: {file.name}
                </p>
              )}
            </div>

            {result && (
              <Alert className={result.success ? "border-green-500" : "border-red-500"}>
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <AlertDescription>
                  {result.success ? (
                    <div className="space-y-1">
                      <p className="font-semibold">Upload completed successfully!</p>
                      <p>Total students registered: {result.uploaded}</p>
                      {result.errors && result.errors.length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-orange-600">
                            {result.errors.length} rows had errors (click to view)
                          </summary>
                          <ul className="mt-2 text-xs list-disc list-inside">
                            {result.errors.map((err: string, i: number) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold">Upload failed</p>
                      <p className="text-sm">{result.error}</p>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
          
          <TabsContent value="teachers" className="space-y-6">
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                <strong>CSV Format Required:</strong> The file must contain at least an "email" column. 
                Optional columns: name, phone, department
              </AlertDescription>
            </Alert>

            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={downloadTemplate}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download Teacher Template
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="csv-upload-teachers">Select CSV File</Label>
              <div className="flex gap-2">
                <Input
                  id="csv-upload-teachers"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
                <Button 
                  onClick={handleUpload} 
                  disabled={!file || uploading}
                  className="min-w-[100px]"
                >
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
              {file && (
                <p className="text-sm text-muted-foreground">
                  Selected: {file.name}
                </p>
              )}
            </div>

            {result && (
              <Alert className={result.success ? "border-green-500" : "border-red-500"}>
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <AlertDescription>
                  {result.success ? (
                    <div className="space-y-1">
                      <p className="font-semibold">Upload completed successfully!</p>
                      <p>Total teachers registered: {result.uploaded}</p>
                      {result.errors && result.errors.length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-orange-600">
                            {result.errors.length} rows had errors (click to view)
                          </summary>
                          <ul className="mt-2 text-xs list-disc list-inside">
                            {result.errors.map((err: string, i: number) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold">Upload failed</p>
                      <p className="text-sm">{result.error}</p>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

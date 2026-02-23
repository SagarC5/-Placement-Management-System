import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const announcementId = formData.get('announcementId') as string;
    const category = formData.get('category') as string;
    const title = formData.get('title') as string;
    const companyName = formData.get('companyName') as string;

    if (!file || !announcementId) {
      throw new Error('Missing required fields');
    }

    // Read Excel file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet);

    console.log('Processing Excel data:', data.length, 'rows');

    const studentEmails = new Set<string>();
    const parentEmails = new Set<string>();

    // Extract emails from various possible column names
    for (const row of data) {
      const rowData = row as any;
      
      // Student email columns
      const studentEmail = rowData['Email'] || rowData['email'] || 
                          rowData['Student Email'] || rowData['student_email'];
      if (studentEmail && typeof studentEmail === 'string') {
        studentEmails.add(studentEmail.trim().toLowerCase());
      }

      // Parent email columns (for shortlisting/selection announcements)
      if (category === 'shortlisting') {
        const parentEmail = rowData['Parent Email'] || rowData['parent_email'] || 
                           rowData['Guardian Email'] || rowData['guardian_email'];
        if (parentEmail && typeof parentEmail === 'string') {
          parentEmails.add(parentEmail.trim().toLowerCase());
        }
      }
    }

    console.log('Found emails - Students:', studentEmails.size, 'Parents:', parentEmails.size);

    // Get student profiles
    const { data: students, error: studentsError } = await supabase
      .from('profiles')
      .select('id, email, name')
      .in('email', Array.from(studentEmails));

    if (studentsError) throw studentsError;

    console.log('Found student profiles:', students?.length);

    // Create notifications and recipient records
    if (students && students.length > 0) {
      // Insert recipient records
      const recipients = students.map(student => ({
        announcement_id: announcementId,
        student_id: student.id,
        notified: true,
        notified_at: new Date().toISOString(),
      }));

      const { error: recipientsError } = await supabase
        .from('announcement_recipients')
        .insert(recipients);

      if (recipientsError) {
        console.error('Error inserting recipients:', recipientsError);
      }

      // Create in-app notifications
      const notifications = students.map(student => ({
        user_id: student.id,
        announcement_id: announcementId,
        title: title,
        message: `${companyName ? `${companyName} - ` : ''}New announcement posted`,
      }));

      const { error: notificationsError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (notificationsError) {
        console.error('Error creating notifications:', notificationsError);
      }

      // Send email notifications
      for (const student of students) {
        try {
          await supabase.functions.invoke('send-notification-email', {
            body: {
              to: student.email,
              subject: title,
              body: `Dear ${student.name},\n\n${companyName ? `Company: ${companyName}\n\n` : ''}A new announcement has been posted:\n\n${title}\n\nPlease check your dashboard for more details.`,
            },
          });
        } catch (emailError) {
          console.error('Error sending email to', student.email, emailError);
        }
      }
    }

    // Send parent notifications for shortlisting
    if (category === 'shortlisting' && parentEmails.size > 0) {
      for (const parentEmail of parentEmails) {
        try {
          await supabase.functions.invoke('send-notification-email', {
            body: {
              to: parentEmail,
              subject: `Student Shortlisted - ${companyName || title}`,
              body: `Dear Parent/Guardian,\n\nYour ward has been shortlisted for the next round by ${companyName || 'the company'}.\n\nPlease check with your ward for more details.\n\nBest regards,\nTraining & Placement Office`,
            },
          });
        } catch (emailError) {
          console.error('Error sending parent email:', emailError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        studentsNotified: students?.length || 0,
        parentsNotified: parentEmails.size,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error processing announcement:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
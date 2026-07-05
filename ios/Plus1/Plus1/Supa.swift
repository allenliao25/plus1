import Foundation
import Supabase

/// Shared Supabase client. URL and anon key are the same public values the
/// web app ships in its client bundle — row-level security protects the data,
/// not these strings. (Same pattern as concert-tracker.)
enum Supa {
    static let client = SupabaseClient(
        supabaseURL: URL(string: "https://qjuiqeclnrvkyjnqltxq.supabase.co")!,
        supabaseKey:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqdWlxZWNsbnJ2a3lqbnFsdHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMjU3NzYsImV4cCI6MjA5NTYwMTc3Nn0.Ykbedp_sOFA0QHuFyOTu9mPOIQtFbSxnS2u-Z4vB5NQ"
    )
}

import { error, json } from '@sveltejs/kit';

export const POST = async ({ locals: { supabase, user }, params, request }) => {
	if (!user) error(401, 'Unauthorized');
	if (!params.id) error(400, 'Missing document id');
    
    const body = await request.json();
    console.log(body);

    const feedback_id = await supabase
        .from('user_feedback')
        .select('id')
        .eq('summary_id', body.summary_id)
        .eq('summary_version', body.summary_version);
    
    // If previous feedback already exists, overwrite it
    if (feedback_id.data != null && feedback_id.data.length > 0) {
        console.log("Feedback already exists, will update!");
        const { error: fetchErr } = await supabase
            .from('user_feedback')
            .update({ rating: body.rating, feedback: body.feedback })
            .eq('id', feedback_id.data[0].id);
        
        if (fetchErr) error(500, 'Failed to fetch feedback');
    }

    // Make a new entry
    else {
        console.log("Making new feedback entry...");
        const { error: insertErr } = await supabase
            .from('user_feedback')
            .insert({ 
                doc_id: params.id, 
                owner_id: user.id,
                rating: body.rating, 
                feedback: body.feedback, 
                summary_id: body.summary_id, 
                summary_version: body.summary_version 
            });
        
        if (insertErr) error(500, 'Failed to insert feedback');
    }

    return json({ status: 201 });
};
// jQuery event handler for ask-question button
$(document).ready(function() {
  // Handle click on any button with class 'ask-question'
  $(document).on('click', '.ask-question', function(e) {
    e.preventDefault();
    
    // Call the /postQuestion API endpoint
    $.ajax({
      url: 'http://localhost:3000/postQuestion',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        user_id:1, //hardcoded for single user for now. 
        //title:$(this).find('input[name="title"]').val(),
        title: "Test Question",
        //body:$(this).find('textarea[name="body"]').val(),
        body: "blah blah blah",
      }),
      success: function(response) {
        console.log('Question posted successfully:', response);
      },
      error: function(xhr, status, error) {
        console.error('Error posting question:', error);
      }
    });
  });

  // Handle click on any button with class 'add-comment'
  $(document).on('click', '.add-comment', function(e) {
    e.preventDefault();
    const questionId = $(this).data('questionid')
    
    // Get the textarea value - it's the previous sibling element
    const textarea = $(this).prev('textarea');
    const commentBody = textarea.length ? textarea.val().trim() : '';

    if (!questionId) {
      console.warn('No question_id found for add-comment button');
      return;
    }

    if (commentBody){
      $.ajax({
        url: 'http://localhost:3000/postComment',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
          user_id: 1,
          question_id: questionId,
          body: commentBody,
        }),
        success: function(response) {
          console.log('Comment posted successfully:', response);
          // Clear the textarea after successful post
          textarea.val('');
        },
        error: function(xhr, status, error) {
          console.error('Error posting comment:', error);
        }
      });
    }
  });
});


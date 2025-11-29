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
    console.log("clicking add comment");
    console.log(this)
    const questionId = $(this).data('questionid')
    //const questionId = $(this).data('questionId') || $('#comments-section').data('questionId');
    //const commentInput = $('#new-comment-body');
    //const rawComment = commentInput.length ? (commentInput.val() || '') : '';
    //const trimmedComment = rawComment.trim();
    //const commentBody = trimmedComment.length > 0 ? trimmedComment : 'This is a placeholder comment.';
    const commentBody = "Test Comment blah blah";

    if (!questionId) {
      console.warn('No question_id found for add-comment button');
      return;
    }

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
      },
      error: function(xhr, status, error) {
        console.error('Error posting comment:', error);
      }
    });
  });
});


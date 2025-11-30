// jQuery event handler for ask-question button
$(document).ready(function() {
  // Handle form submission for question form
  $(document).on('submit', 'form[id$="-question-form"]', function(e) {
    e.preventDefault();
    
    const $form = $(this);
    const title = $form.find('input[name="title"]').val().trim();
    const body = $form.find('textarea[name="body"]').val().trim();
    
    if (!title || !body) {
      console.warn('Title and body are required');
      return;
    }
    
    // Call the /postQuestion API endpoint
    $.ajax({
      url: 'http://localhost:3000/postQuestion',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        user_id: 1, //hardcoded for single user for now. 
        title: title,
        body: body,
      }),
      success: function(response) {
        console.log('Question posted successfully:', response);
        // Hide the form and show questions section
        const formId = $form.attr('id');
        const name = formId.replace('-question-form', '');
        $('.' + name + '-new-question').hide();
        $('.' + name + '-quests').show();
        // Clear the form
        $form[0].reset();
        // TODO: Reload questions list to show the new question
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
          // Reload comments to show the new comment
          // Find the comments section that matches this question
          const $commentsSection = $('[id$="-comments-section"]').filter(function() {
            return $(this).data('question-id') == questionId;
          });
          if ($commentsSection.length > 0) {
            const storedId = $commentsSection.data('question-id');
            const storedTitle = $commentsSection.data('question-title');
            const storedUserId = $commentsSection.data('question-user-id');
            if (storedId && storedTitle && storedUserId && window.reloadCommentsForQuestion) {
              window.reloadCommentsForQuestion(storedId, storedTitle, storedUserId);
            }
          }
        },
        error: function(xhr, status, error) {
          console.error('Error posting comment:', error);
        }
      });
    }
  });
});


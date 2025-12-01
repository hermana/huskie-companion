
function updateCurrentUserXP(xp) {
  console.log('Updating user XP:', xp);
  $.ajax({
      url: 'http://localhost:3000/updateUserXP',
      type: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify({
          user_id: clippy.Balloon.prototype.DEMO_PLAYER_ID,
          xp: xp
      }),
      success: function(data) {
          if (data.success) {
              console.log('User XP updated successfully:', data.xp);
          } else {
              console.warn('Failed to update user XP:', data.error);
          }
      },
      error: function(xhr, status, error) {
          console.error('Error updating user XP:', error);
      }
  });
}

// Helper function to get balloon instance by name
function getBalloonByName(name) {
  // Try to find the balloon through stored agent instances
  if (window.clippyAgents && window.clippyAgents[name]) {
    return window.clippyAgents[name]._balloon;
  }
  // Fallback: try to find through DOM elements
  // The balloon creates elements with classes containing the name
  const $balloonEl = $('.clippy-balloon').filter(function() {
    return $(this).find('.' + name + '-huskie').length > 0;
  });
  if ($balloonEl.length > 0 && $balloonEl.data('balloonInstance')) {
    return $balloonEl.data('balloonInstance');
  }
  return null;
}

function calculateCurrentUserXP(action, name){
  // Get the balloon instance to access _xp
  const balloon = getBalloonByName(name);
  if (!balloon) {
    console.warn('Could not find balloon instance for name:', name);
    return;
  }
  
  // Get current XP from balloon
  let xp = balloon._xp || 0;
  
  switch(action){
      case 'commented':
        if(xp > 0){xp += Math.log(xp) / 2;} else{xp=100;}
        break;
      case 'asked_question':
        if(xp > 0){xp += Math.log(xp);} else{xp=100;}
        break;
  }
  updateCurrentUserXP(xp);
}


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
        user_id: clippy.Balloon.prototype.DEMO_PLAYER_ID,
        title: title,
        body: body,
      }),
      success: function(response) {
        console.log('Question posted successfully:', response);
        // Hide the form and show questions section
        const formId = $form.attr('id');
        const name = formId.replace('-question-form', '');
        calculateCurrentUserXP('asked_question', name);
        
        // Update question count
        const balloon = getBalloonByName(name);
        if (balloon) {
          balloon._num_questions = (balloon._num_questions || 0) + 1;
          const $display = $('.' + name + '-huskie .num-questions-value');
          if ($display.length > 0) {
            $display.text(balloon._num_questions);
          }
        }
        
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
          user_id: clippy.Balloon.prototype.DEMO_PLAYER_ID,
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
          // Extract name from comments section id (format: {name}-comments-section)
          const commentsSectionId = $commentsSection.attr('id');
          const name = commentsSectionId ? commentsSectionId.replace('-comments-section', '') : null;
          if (name) {
            calculateCurrentUserXP('commented', name);
          }
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


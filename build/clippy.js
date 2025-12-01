var clippy = {};

/***********Used for Demo Purposes**************/
// also these should be switches 
function getUserIDFromName(name){
    switch(name){
        case "Rover":
            return 1;
            break;
        case "Peedy":
            return 2;
            break;
        case "Bonzi":
            return 3;
            break;
        default:
            return 0;
            break;
        }
}

function getUserNameFromID(id){
    switch(Number(id)){
        case (1):
            return "Rover";
            break;
        case (2):
            return "Peedy";
            break;
        case (3):
            return "Bonzi";
            break;
        default:
            return "Anonymous User";
    }
}

function getUserXPFromBrowser(name){
    // Get the balloon instance for the given name
    if (window.clippyAgents && window.clippyAgents[name] && window.clippyAgents[name]._balloon) {
        return window.clippyAgents[name]._balloon._xp || 0;
    }
    // Return 0 if agent/balloon not found
    return 0;
}
/******
 *
 *
 * @constructor
 */
clippy.Agent = function (path, data, sounds, name) {
    this.path = path;

    this._queue = new clippy.Queue($.proxy(this._onQueueEmpty, this));

    this._el = $('<div class="clippy"></div>').hide();

    $(document.body).append(this._el);

    this._animator = new clippy.Animator(this._el, path, data, sounds);

    this._balloon = new clippy.Balloon(this._el, name);

    this._setupEvents();
};

clippy.Agent.prototype = {

    /**************************** API ************************************/

    /***
     *
     * @param {Number} x
     * @param {Number} y
     */
    gestureAt:function (x, y) {
        var d = this._getDirection(x, y);
        var gAnim = 'Gesture' + d;
        var lookAnim = 'Look' + d;

        var animation = this.hasAnimation(gAnim) ? gAnim : lookAnim;
        return this.play(animation);
    },

    /***
     *
     * @param {Boolean=} fast
     *
     */
    hide:function (fast, callback) {
        this._hidden = true;
        var el = this._el;
        this.stop();
        if (fast) {
            this._el.hide();
            this.stop();
            this.pause();
            if (callback) callback();
            return;
        }

        return this._playInternal('Hide', function () {
            el.hide();
            this.pause();
            if (callback) callback();
        })
    },


    moveTo:function (x, y, duration) {
        var dir = this._getDirection(x, y);
        var anim = 'Move' + dir;
        if (duration === undefined) duration = 1000;

        this._addToQueue(function (complete) {
            // the simple case
            if (duration === 0) {
                this._el.css({top:y, left:x});
                this.reposition();
                complete();
                return;
            }

            // no animations
            if (!this.hasAnimation(anim)) {
                this._el.animate({top:y, left:x}, duration, complete);
                return;
            }

            var callback = $.proxy(function (name, state) {
                // when exited, complete
                if (state === clippy.Animator.States.EXITED) {
                    complete();
                }
                // if waiting,
                if (state === clippy.Animator.States.WAITING) {
                    this._el.animate({top:y, left:x}, duration, $.proxy(function () {
                        // after we're done with the movement, do the exit animation
                        this._animator.exitAnimation();
                    }, this));
                }

            }, this);

            this._playInternal(anim, callback);
        }, this);
    },

    _playInternal:function (animation, callback) {

        // if we're inside an idle animation,
        if (this._isIdleAnimation() && this._idleDfd && this._idleDfd.state() === 'pending') {
            this._idleDfd.done($.proxy(function () {
                this._playInternal(animation, callback);
            }, this))
        }

        this._animator.showAnimation(animation, callback);
    },

    play:function (animation, timeout, cb) {
        if (!this.hasAnimation(animation)) return false;

        if (timeout === undefined) timeout = 5000;


        this._addToQueue(function (complete) {
            var completed = false;
            // handle callback
            var callback = function (name, state) {
                if (state === clippy.Animator.States.EXITED) {
                    completed = true;
                    if (cb) cb();
                    complete();
                }
            };

            // if has timeout, register a timeout function
            if (timeout) {
                window.setTimeout($.proxy(function () {
                    if (completed) return;
                    // exit after timeout
                    this._animator.exitAnimation();
                }, this), timeout)
            }

            this._playInternal(animation, callback);
        }, this);

        return true;
    },

    /***
     *
     * @param {Boolean=} fast
     */
    show:function (fast) {

        this._hidden = false;
        if (fast) {
            this._el.show();
            this.resume();
            this._onQueueEmpty();
            return;
        }

        if (this._el.css('top') === 'auto' || !this._el.css('left') === 'auto') {
            var left = $(window).width() * 0.8;
            var top = ($(window).height() + $(document).scrollTop()) * 0.8;
            this._el.css({top:top, left:left});
        }

        this.resume();
        return this.play('Show');
    },

    /***
     *
     * @param {String} text
     */
    speak:function (text, hold) {
        this._addToQueue(function (complete) {
            this._balloon.speak(complete, text, hold);
        }, this);
    },

    openGame:function () {
        //FIXME: what was the point of queuing events?? and why didn't it work after the second click!!
        this._balloon.openGame();
        // this._addToQueue(function () {
        //     this._balloon.openGame();
        // }, this);
    },

    /***
     * Close the current balloon
     */
    closeBalloon:function () {
        this._balloon.hide();
    },

    delay:function (time) {
        time = time || 250;

        this._addToQueue(function (complete) {
            this._onQueueEmpty();
            window.setTimeout(complete, time);
        });
    },

    /***
     * Skips the current animation
     */
    stopCurrent:function () {
        this._animator.exitAnimation();
        this._balloon.close();
    },


    stop:function () {
        // clear the queue
        this._queue.clear();
        this._animator.exitAnimation();
        this._balloon.hide();
    },

    /***
     *
     * @param {String} name
     * @returns {Boolean}
     */
    hasAnimation:function (name) {
        return this._animator.hasAnimation(name);
    },

    /***
     * Gets a list of animation names
     *
     * @return {Array.<string>}
     */
    animations:function () {
        return this._animator.animations();
    },

    /***
     * Play a random animation
     * @return {jQuery.Deferred}
     */
    animate:function () {
        var animations = this.animations();
        var anim = animations[Math.floor(Math.random() * animations.length)];
        // skip idle animations
        if (anim.indexOf('Idle') === 0) {
            return this.animate();
        }
        return this.play(anim);
    },

    /**************************** Utils ************************************/

    /***
     *
     * @param {Number} x
     * @param {Number} y
     * @return {String}
     * @private
     */
    _getDirection:function (x, y) {
        var offset = this._el.offset();
        var h = this._el.height();
        var w = this._el.width();

        var centerX = (offset.left + w / 2);
        var centerY = (offset.top + h / 2);


        var a = centerY - y;
        var b = centerX - x;

        var r = Math.round((180 * Math.atan2(a, b)) / Math.PI);

        // Left and Right are for the character, not the screen :-/
        if (-45 <= r && r < 45) return 'Right';
        if (45 <= r && r < 135) return 'Up';
        if (135 <= r && r <= 180 || -180 <= r && r < -135) return 'Left';
        if (-135 <= r && r < -45) return 'Down';

        // sanity check
        return 'Top';
    },

    /**************************** Queue and Idle handling ************************************/

    /***
     * Handle empty queue.
     * We need to transition the animation to an idle state
     * @private
     */
    _onQueueEmpty:function () {
        if (this._hidden || this._isIdleAnimation()) return;
        var idleAnim = this._getIdleAnimation();
        this._idleDfd = $.Deferred();

        this._animator.showAnimation(idleAnim, $.proxy(this._onIdleComplete, this));
    },

    _onIdleComplete:function (name, state) {
        if (state === clippy.Animator.States.EXITED) {
            this._idleDfd.resolve();
        }
    },


    /***
     * Is the current animation is Idle?
     * @return {Boolean}
     * @private
     */
    _isIdleAnimation:function () {
        var c = this._animator.currentAnimationName;
        return c && c.indexOf('Idle') === 0;
    },


    /**
     * Gets a random Idle animation
     * @return {String}
     * @private
     */
    _getIdleAnimation:function () {
        var animations = this.animations();
        var r = [];
        for (var i = 0; i < animations.length; i++) {
            var a = animations[i];
            if (a.indexOf('Idle') === 0) {
                r.push(a);
            }
        }

        // pick one
        var idx = Math.floor(Math.random() * r.length);
        return r[idx];
    },

    /**************************** Events ************************************/

    _setupEvents:function () {
        $(window).on('resize', $.proxy(this.reposition, this));

        this._el.on('mousedown', $.proxy(this._onMouseDown, this));

        this._el.on('dblclick', $.proxy(this._onDoubleClick, this));

        this._el.on('click', $.proxy(this._onClick, this));
    },

    _onDoubleClick:function () {
        if (!this.play('ClickedOn')) {
            this.animate();
        }
    },

    _onClick:function () {
       // Increment click counter when agent is clicked, but only if balloon was hidden
       if (this._balloon && this._balloon._hidden) {
           this._balloon._num_clicks = (this._balloon._num_clicks || 0) + 1;
           // Update the display in the browser
           const selector = '.' + this._balloon._name + '-huskie .num-clicks-value';
           const $display = $(selector);
           if ($display.length > 0) {
               $display.text(this._balloon._num_clicks);
           } else {
               console.warn('Could not find element with selector:', selector);
           }
           
           // Asynchronously update the user's num_clicks in the database
           $.ajax({
               url: 'http://localhost:3000/updateUserNumClicks',
               type: 'PUT',
               contentType: 'application/json',
               data: JSON.stringify({
                   user_id: clippy.Balloon.prototype.DEMO_PLAYER_ID,
                   num_clicks: this._balloon._num_clicks
               }),
               success: function(data) {
                   if (data.success) {
                       console.log('User num_clicks updated successfully:', data.num_clicks);
                   } else {
                       console.warn('Failed to update user num_clicks:', data.error);
                   }
               },
               error: function(xhr, status, error) {
                   console.error('Error updating user num_clicks:', error);
               }
           });
       }
       this.openGame();
    },

    reposition:function () {
        if (!this._el.is(':visible')) return;
        var o = this._el.offset();
        var bH = this._el.outerHeight();
        var bW = this._el.outerWidth();

        var wW = $(window).width();
        var wH = $(window).height();
        var sT = $(window).scrollTop();
        var sL = $(window).scrollLeft();

        var top = o.top - sT;
        var left = o.left - sL;
        var m = 5;
        if (top - m < 0) {
            top = m;
        } else if ((top + bH + m) > wH) {
            top = wH - bH - m;
        }

        if (left - m < 0) {
            left = m;
        } else if (left + bW + m > wW) {
            left = wW - bW - m;
        }

        this._el.css({left:left, top:top});
        // reposition balloon
        this._balloon.reposition();
    },

    _onMouseDown:function (e) {
        e.preventDefault();
        this._startDrag(e);
    },


    /**************************** Drag ************************************/

    _startDrag:function (e) {
        this._offset = this._calculateClickOffset(e);
        // pause animations
        this.pause();
        //this._balloon.hide(true);

        this._moveHandle = $.proxy(this._dragMove, this);
        this._upHandle = $.proxy(this._finishDrag, this);

        $(window).on('mousemove', this._moveHandle);
        $(window).on('mouseup', this._upHandle);

        this._dragUpdateLoop = window.setTimeout($.proxy(this._updateLocation, this), 10);
    },

    _calculateClickOffset:function (e) {
        var mouseX = e.pageX;
        var mouseY = e.pageY;
        var o = this._el.offset();
        return {
            top:mouseY - o.top,
            left:mouseX - o.left
        }

    },

    _updateLocation:function () {
        this._el.css({top:this._targetY, left:this._taregtX});
        this._dragUpdateLoop = window.setTimeout($.proxy(this._updateLocation, this), 10);
    },

    _dragMove:function (e) {
        e.preventDefault();
        var x = e.clientX - this._offset.left;
        var y = e.clientY - this._offset.top;
        this._taregtX = x;
        this._targetY = y;
    },

    _finishDrag:function () {
        window.clearTimeout(this._dragUpdateLoop);
        // remove handles
        $(window).off('mousemove', this._moveHandle);
        $(window).off('mouseup', this._upHandle);
        // resume animations
        //this._balloon.show();
        this.reposition();
        this.resume();

    },

    _addToQueue:function (func, scope) {
        if (scope) func = $.proxy(func, scope);
        this._queue.queue(func);
    },

    /**************************** Pause and Resume ************************************/

    pause:function () {
        this._animator.pause();
        this._balloon.pause();

    },

    resume:function () {
        this._animator.resume();
        this._balloon.resume();
    }

};

/******
 *
 *
 * @constructor
 */
clippy.Animator = function (el, path, data, sounds) {
    this._el = el;
    this._data = data;
    this._path = path;
    this._currentFrameIndex = 0;
    this._currentFrame = undefined;
    this._exiting = false;
    this._currentAnimation = undefined;
    this._endCallback = undefined;
    this._started = false;
    this._sounds = {};
    this.currentAnimationName = undefined;
    this.preloadSounds(sounds);
    this._overlays = [this._el];
    var curr = this._el;

    this._setupElement(this._el);
    for (var i = 1; i < this._data.overlayCount; i++) {
        var inner = this._setupElement($('<div></div>'));

        curr.append(inner);
        this._overlays.push(inner);
        curr = inner;
    }
};

clippy.Animator.prototype = {
    _setupElement:function (el) {
        var frameSize = this._data.framesize;
        el.css('display', "none");
        el.css({width:frameSize[0], height:frameSize[1]});
        el.css('background', "url('" + this._path + "/map.png') no-repeat");

        return el;
    },

    animations:function () {
        var r = [];
        var d = this._data.animations;
        for (var n in d) {
            r.push(n);
        }
        return r;
    },

    preloadSounds:function (sounds) {

        for (var i = 0; i < this._data.sounds.length; i++) {
            var snd = this._data.sounds[i];
            var uri = sounds[snd];
            if (!uri) continue;
            this._sounds[snd] = new Audio(uri);

        }
    },
    hasAnimation:function (name) {
        return !!this._data.animations[name];
    },

    exitAnimation:function () {
        this._exiting = true;
    },


    showAnimation:function (animationName, stateChangeCallback) {
        this._exiting = false;

        if (!this.hasAnimation(animationName)) {
            return false;
        }

        this._currentAnimation = this._data.animations[animationName];
        this.currentAnimationName = animationName;


        if (!this._started) {
            this._step();
            this._started = true;
        }

        this._currentFrameIndex = 0;
        this._currentFrame = undefined;
        this._endCallback = stateChangeCallback;

        return true;
    },


    _draw:function () {
        var images = [];
        if (this._currentFrame) images = this._currentFrame.images || [];

        for (var i = 0; i < this._overlays.length; i++) {
            if (i < images.length) {
                var xy = images[i];
                var bg = -xy[0] + 'px ' + -xy[1] + 'px';
                this._overlays[i].css({'background-position':bg, 'display':'block'});
            }
            else {
                this._overlays[i].css('display', 'none');
            }

        }
    },

    _getNextAnimationFrame:function () {
        if (!this._currentAnimation) return undefined;
        // No current frame. start animation.
        if (!this._currentFrame) return 0;
        var currentFrame = this._currentFrame;
        var branching = this._currentFrame.branching;


        if (this._exiting && currentFrame.exitBranch !== undefined) {
            return currentFrame.exitBranch;
        }
        else if (branching) {
            var rnd = Math.random() * 100;
            for (var i = 0; i < branching.branches.length; i++) {
                var branch = branching.branches[i];
                if (rnd <= branch.weight) {
                    return branch.frameIndex;
                }

                rnd -= branch.weight;
            }
        }

        return this._currentFrameIndex + 1;
    },


    _atLastFrame:function () {
        return this._currentFrameIndex >= this._currentAnimation.frames.length - 1;
    },

    _step:function () {
        if (!this._currentAnimation) return;
        var newFrameIndex = Math.min(this._getNextAnimationFrame(), this._currentAnimation.frames.length - 1);
        var frameChanged = !this._currentFrame || this._currentFrameIndex !== newFrameIndex;
        this._currentFrameIndex = newFrameIndex;

        // always switch frame data, unless we're at the last frame of an animation with a useExitBranching flag.
        if (!(this._atLastFrame() && this._currentAnimation.useExitBranching)) {
            this._currentFrame = this._currentAnimation.frames[this._currentFrameIndex];
        }

        this._draw();

        this._loop = window.setTimeout($.proxy(this._step, this), this._currentFrame.duration);


        // fire events if the frames changed and we reached an end
        if (this._endCallback && frameChanged && this._atLastFrame()) {
            if (this._currentAnimation.useExitBranching && !this._exiting) {
                this._endCallback(this.currentAnimationName, clippy.Animator.States.WAITING);
            }
            else {
                this._endCallback(this.currentAnimationName, clippy.Animator.States.EXITED);
            }
        }
    },

    /***
     * Pause animation execution
     */
    pause:function () {
        window.clearTimeout(this._loop);
    },

    /***
     * Resume animation
     */
    resume:function () {
        this._step();
    }
};

clippy.Animator.States = { WAITING:1, EXITED:0 };

/******
 *
 *
 * @constructor
 */
clippy.Balloon = function (targetEl, name) {
    this._targetEl = targetEl;
    this._name = name
    this._hidden = true;
    this._num_clicks = 0; // Will be updated from database
    this._xp = 0; 
    this._num_questions = 0; // Will be updated when questions are fetched
    this._setup(name);
    
    // Fetch num_clicks 
    $.ajax({
        url: 'http://localhost:3000/getUserNumClicks',
        type: 'GET',
        data: { user_id: clippy.Balloon.prototype.DEMO_PLAYER_ID },
        success: (data) => {
            if (data.success && data.num_clicks !== undefined) {
                this._num_clicks = data.num_clicks;
                // Update the display if it exists
                const selector = '.' + this._name + '-huskie h3';
                const $display = $(selector);
                if ($display.length > 0) {
                    $display.text(this._num_clicks);
                }
            }
        },
        error: (xhr, status, error) => {
            console.error('Error getting user num_clicks:', error);
            // Keep default value of 0 if fetch fails
        }
    });
    // Fetch xp from database
    $.ajax({
        url: 'http://localhost:3000/getUserXP',
        type: 'GET',
        data: { user_id: clippy.Balloon.prototype.DEMO_PLAYER_ID },
        success: (data) => {
            if (data.success && data.xp !== undefined) {
                this._xp = data.xp;
                // Update the display if it exists
                const selector = '.' + this._name + '-huskie .xp-value';
                const $display = $(selector);
                if ($display.length > 0) {
                    $display.text(this._xp);
                }
            }
        },
        error: (xhr, status, error) => {
            console.error('Error getting user xp:', error);
            // Keep default value of 0 if fetch fails
        }
    });
};

clippy.Balloon.prototype = {

   WORD_SPEAK_TIME:320,
   CLOSE_BALLOON_DELAY:5000000, //For debugging for now, but will also need to be longer.
   DEMO_PLAYER_ID:1,

    _setup:function (name) {
        // Store reference to balloon instance for use in event handlers
        var balloon = this;

        //this._balloon = $('<div class="clippy-balloon"><div class="clippy-tip"></div><div class="clippy-content"></div></div> ').hide();
        this._balloon = this._getGameContent();
        this._content = this._balloon.find('.clippy-content');


        $(document.body).append(this._balloon);

        $("#"+this._name+"-huskie-btn").click(function(){
            $("."+name+"-quests").hide();
            $("."+name+"-huskie").show();
            $("."+name+"-new-question").hide();
            $("article."+name+"-question-one").hide();
            $('#'+name+'-comments-section').empty();
            $('#'+name+'-comments-section').hide();
        });

        $("#"+this._name+"-quest-btn").click(function(){
            $("."+name+"-quests").show();
            $("."+name+"-huskie").hide();
            $("."+name+"-new-question").hide();
            $("article."+name+"-question-one").hide();
            $('#'+name+'-comments-section').hide();
        });

        $("#"+this._name+"-ask-question").click(function(e){
            e.preventDefault();
            $("."+name+"-quests").hide();
            $("."+name+"-new-question").show();
            $('#'+name+'-comments-section').hide();
        });

        $("#"+this._name+"-cancel-question").click(function(e){
            e.preventDefault();
            $("."+name+"-new-question").hide();
            $("."+name+"-quests").show();
            $('#'+name+'-comments-section').hide();
            // Clear the form
            $("#"+name+"-question-form")[0].reset();
        });

        $("#"+this._name+"-question-one").click(function(){
            $("."+name+"-quests").hide();
            $("article."+name+"-question-one").show();
        });

        $("#"+this._name+"-back-btn").click(function(){
            $("."+name+"-quests").show();
            $("#"+name+"-comments-section").empty();
            $("#"+name+"-comments-section").hide();
        });

        $(document).on('click', '.upvote-btn', function(){
            let comment_id = $(this).data("comment-id");
            let commenter = $(this).data("commenter");
            let $btn = $(this);
            $.ajax({
                url: 'http://localhost:3000/postUpvote',
                type: 'POST',
                data: JSON.stringify({
                    user_id: clippy.Balloon.prototype.DEMO_PLAYER_ID,
                    comment_id: comment_id
                }),
                contentType: 'application/json',
                async: false,
                success: function(data) {
                    if (data.success) {
                        $btn.addClass('upvoted');
                        $.ajax({
                            url: 'http://localhost:3000/getUpvotes',
                            type: 'GET',
                            data: { comment_id: comment_id },
                            async: false,
                            success: function(upvoteData) {
                                if (upvoteData.success && upvoteData.upvotes) {
                                    $('#upvotes-' + comment_id).text(upvoteData.upvotes.length);
                                }
                                balloon.calculateFriendXP(commenter, 'upvoted');
                            }
                        });
                    } else {
                        console.warn('Failed to post upvote:', data.error);
                    }
                },
                error: function(xhr, status, error) {
                    if (xhr.status === 409) {
                        // Upvote already exists for this user/comment (unique constraint)
                        console.warn('User has already upvoted this comment.');
                        // Ensure button is marked as upvoted
                        $btn.addClass('upvoted');
                    } else {
                        console.error('Error posting upvote:', error);
                    }
                }
            });

        })

        // Handle click on checkmark to accept a comment
        $(document).on('click', '.check[data-comment-id]', function(){
            let comment_id = $(this).data("comment-id");
            let commenter = $(this).data("commenter");
            let $checkmark = $(this);
            
            // Don't do anything if already accepted
            if ($checkmark.hasClass('accepted')) {
                return;
            }
            
            // Find all checkmarks in the same comments section
            // Find the comments section by looking for the parent article element
            const $commentsSection = $checkmark.closest('article[id$="-comments-section"]');
            const $allCheckmarks = $commentsSection.find('.check[data-comment-id]');
            
            // Check if any other comment is already accepted
            let hasOtherAccepted = false;
            $allCheckmarks.each(function() {
                if ($(this).hasClass('accepted') && $(this).data('comment-id') !== comment_id) {
                    hasOtherAccepted = true;
                    return false; // break the loop
                }
            });
            
            // If another comment is already accepted, don't allow this action
            if (hasOtherAccepted) {
                return;
            }
            
            $.ajax({
                url: 'http://localhost:3000/updateAcceptedResponse',
                type: 'PUT',
                contentType: 'application/json',
                data: JSON.stringify({
                    comment_id: comment_id
                }),
                success: function(data) {
                    if (data.success) {
                        balloon.calculateFriendXP(commenter, 'answer_accepted');
                        // Update all checkmarks: set clicked one to accepted, all others to not-accepted
                        $allCheckmarks.each(function() {
                            const $check = $(this);
                            if ($check.data('comment-id') == comment_id) {
                                $check.removeClass('not-accepted').addClass('accepted');
                            } else {
                                $check.removeClass('accepted').addClass('not-accepted');
                            }
                        });
                    } else {
                        console.warn('Failed to update accepted response:', data.error);
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Error updating accepted response:', error);
                }
            });
        })

        // Function to load/reload comments for a question
        function loadCommentsForQuestion(id, title, body, user_id) {
            let name = getUserNameFromID(user_id);
            $("."+name+"-quests").hide();
            $("."+name+"-new-question").hide();
            $.ajax({
                url: 'http://localhost:3000/getComments',
                type: 'GET',
                data: { question_id: id },
                async: false, // synchronous
                success: function(data) {
                    if (data.success) {   //&& data.comments) { 
                        name = getUserNameFromID(user_id);
                        // Save all comments to the comments object // id, user_id, question_id, body, created_at
                        // Add a simple left-arrow back button to the header.
                        // The button will have an id for possible event hooks.
                        threadHeaderHTML = `<header>
                            <h2 id="`+name+`-back-btn" class="back-btn">&#8592;</h2>
                            <h1 style="margin:0;">${title}</h1>
                            <p>${body}</p>
                            </header>`;

                        data.comments.forEach(comment => {
                            comment.commenter = getUserNameFromID(comment.user_id);
                            //get the upvotes for that comment 
                          // Synchronously fetch upvotes for this comment
                            comment.upvotes = 0; // initialize
                            comment.userHasUpvoted = false; // initialize
                            $.ajax({
                                url: 'http://localhost:3000/getUpvotes',
                                type: 'GET',
                                data: { comment_id: comment.id },
                                async: false, // synchronous
                                success: function(upvoteData) {
                                    if (upvoteData.success && upvoteData.upvotes) {
                                        comment.upvotes = upvoteData.upvotes.length;
                                        // Check if current user has upvoted this comment
                                        const currentUserId = clippy.Balloon.prototype.DEMO_PLAYER_ID;
                                        comment.userHasUpvoted = upvoteData.upvotes.some(upvote => upvote.user_id === currentUserId);
                                    } else {
                                        comment.upvotes = 0;
                                        comment.userHasUpvoted = false;
                                    }
                                },
                                error: function(xhr, status, error) {
                                    console.error(`Error getting upvotes for comment ${comment.id}:`, error);
                                    comment.upvotes = 0;
                                    comment.userHasUpvoted = false;
                                }
                            });
                          });  
                        commentsHTML = data.comments.map(comment =>  {
                            const isAccepted = comment.accepted_response === 1;
                            return `
                            <div class="content">
                                <div class="byline">Answer by <strong>${comment.commenter}</strong><div class='check ${isAccepted ? 'accepted' : 'not-accepted'}' data-comment-id="${comment.id}" data-commenter="${comment.commenter}" style="cursor: pointer;">&#x2713</div></div>
                                <button class="upvote-btn ${comment.userHasUpvoted ? 'upvoted' : ''}" data-comment-id="${comment.id}">&#x25B2</button>
                                <span class="upvote-count" id="upvotes-${comment.id}">${comment.upvotes || 0}</span>
                                <p style="margin:0">${comment.body}</p>
                            </div>
                        `;
                        }).join('');
                        addCommentButtonHTML = `<textarea placeholder="Add a comment..."></textarea><button id="`+name+`-add-comment" class="add-comment" data-questionId="${id}">Add a Comment</button>`;

                        $('#'+name+'-comments-section').html(threadHeaderHTML + commentsHTML + addCommentButtonHTML);
                        $('#'+name+'-comments-section').show();
                        // Store question info for reloading comments later
                        $('#'+name+'-comments-section').data('question-id', id);
                        $('#'+name+'-comments-section').data('question-title', title);
                        $('#'+name+'-comments-section').data('question-user-id', user_id); 

                        $("#"+name+"-back-btn").click(function(){
                            $("."+name+"-quests").show();
                            $('#'+name+'-comments-section').empty();
                            $('#'+name+'-comments-section').hide();
                        });
                    } else {
                        console.error('Failed to retrieve comments:', data.error || data);
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Error calling getComments API:', error);
                }
            });
        }

        // Make the function globally accessible for reloading comments
        window.reloadCommentsForQuestion = loadCommentsForQuestion;

        $(".question").click(function(){
            let id = this.getAttribute("data-id");
            let body = this.getAttribute("data-body");
            let title = this.getAttribute("data-title");
            let user_id = this.getAttribute("data-user-id");
            loadCommentsForQuestion(id, title, body, user_id);
            })
    },

    _getGameContent:function () {
        // Call getQuestions API when _getGameContent is called
        // Using synchronous AJAX to wait for the response before returning HTML
        let questionsHTML = ``;
        let id = getUserIDFromName(this._name);
        $.ajax({
            url: 'http://localhost:3000/getQuestions',
            type: 'GET',
            data: { user_id: id },
            async: false, // Make synchronous to wait for response
            success: (data) => {
                if (data.success && data.questions) {
                    // Update the question count
                    this._num_questions = data.questions.length;
                    questionsHTML = data.questions.map(question => `
                        <div class="card thread question" data-id=${question.id} data-body="${question.body}" data-title="${question.title}" data-user-id="${question.user_id}">
                            <div>
                                <h3><a>${question.title}</a></h3>
                            </div>
                        </div>
                    `).join('');
                }
            },
            error: function(xhr, status, error) {
                console.error('Error calling getQuestions API:', error);
            }
        });

    //     <section class="post">
    //     <div class="byline">Question posted 2 hours ago</div>
    //     <div class="content">
    //     <p>Here are some more details on the question and some elaboration.</p>
    //     </div>
    // </section>

        return $(`
        <div class="clippy-balloon">
        <div class="clippy-content">

        <article id="`+this._name+`-comments-section" class="thread-view card" style="display:none;"></article>
            
        <section id="`+this._name+`-home" class="home-section">
        <div class="`+this._name+`-quests">
            <div class="header-row" style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; margin-bottom: 1.5rem;">
                <h2 class="header" style="margin: 0;">`+this._name+`'s Questions</h2>
                <button id="`+this._name+`-ask-question" class="ask-question" style="margin: 0;">Ask a Question</button>
            </div>
               <div class="forum-questions">
                ${questionsHTML}
               </div>
        </div>
        <div class="`+this._name+`-new-question" style="display:none;">
            <h2 class="header" style="margin-top:1rem">Ask a Question</h2>
            <form id="`+this._name+`-question-form">
                <label for="`+this._name+`-question-title">Title:</label>
                <input type="text" id="`+this._name+`-question-title" name="title" placeholder="Enter question title..." style="width: 100%; padding: 0.5rem; margin-bottom: 1rem; border: 1px solid var(--border); border-radius: var(--radius);" required>
                <label for="`+this._name+`-question-body">Body:</label>
                <textarea id="`+this._name+`-question-body" name="body" placeholder="Enter question details..." rows="6" style="width: 100%; padding: 0.5rem; margin-bottom: 1rem; border: 1px solid var(--border); border-radius: var(--radius); resize: vertical;" required></textarea>
                <div style="display: flex; gap: 0.5rem;">
                    <button type="submit" class="ask-question" style="padding: 0.6rem 1.25rem;">Submit Question</button>
                    <button type="button" id="`+this._name+`-cancel-question" class="btn" style="padding: 0.6rem 1.25rem;">Cancel</button>
                </div>
            </form>
        </div>
        <div class="`+this._name+`-huskie" hidden=true>
            <h2 class="header" style="margin-top:1rem">Stats</h2>
            <h3>Number of clicks: <span class="num-clicks-value">`+this._num_clicks+`</span></h3>
            <h3>XP: <span class="xp-value">`+this._xp+`</span></h3>
            <h3>Questions asked: <span class="num-questions-value">`+this._num_questions+`</span></h3>
        </div>
        </section>
        </div>
        <div class="button-row">
            <button id="`+this._name+`-quest-btn" class="btn">Questions</button>
            <button id="`+this._name+`-huskie-btn" class="btn">Stats</button>
        </div>
        </div>
        `);
    },


        // <div class="`+this._name+`-toolkit" hidden=true>
        //     <h2 class="header" style="margin-top:1rem">My Toolkit</h2>
        // </div>
        // <button id="`+this._name+`-toolkit-btn" class="btn">My Toolkit</button>

    reposition:function () {
        var sides = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

        for (var i = 0; i < sides.length; i++) {
            var s = sides[i];
            this._position(s);
            if (!this._isOut()) break;
        }
    },

    _BALLOON_MARGIN:15,

    /***
     *
     * @param side
     * @private
     */
    _position:function (side) {
        var o = this._targetEl.offset();
        var h = this._targetEl.height();
        var w = this._targetEl.width();

        var bH = this._balloon.outerHeight();
        var bW = this._balloon.outerWidth();

        this._balloon.removeClass('clippy-top-left');
        this._balloon.removeClass('clippy-top-right');
        this._balloon.removeClass('clippy-bottom-right');
        this._balloon.removeClass('clippy-bottom-left');

        var left, top;
        switch (side) {
            case 'top-left':
                // right side of the balloon next to the right side of the agent
                left = o.left + w - bW;
                top = o.top - bH - this._BALLOON_MARGIN;
                break;
            case 'top-right':
                // left side of the balloon next to the left side of the agent
                left = o.left;
                top = o.top - bH - this._BALLOON_MARGIN;
                break;
            case 'bottom-right':
                // right side of the balloon next to the right side of the agent
                left = o.left;
                top = o.top + h + this._BALLOON_MARGIN;
                break;
            case 'bottom-left':
                // left side of the balloon next to the left side of the agent
                left = o.left + w - bW;
                top = o.top + h + this._BALLOON_MARGIN;
                break;
        }

        this._balloon.css({top:top, left:left});
        this._content.css({top:top, left:left});
        this._balloon.addClass('clippy-' + side);
        // FIXME: add consts or have them be able to change the size
        this._balloon.width(500);
        this._balloon.height(500);

    },

    _isOut:function () {
        var o = this._balloon.offset();
        var bH = this._balloon.outerHeight();
        var bW = this._balloon.outerWidth();

        var wW = $(window).width();
        var wH = $(window).height();
        var sT = $(document).scrollTop();
        var sL = $(document).scrollLeft();

        var top = o.top - sT;
        var left = o.left - sL;
        var m = 5;
        if (top - m < 0 || left - m < 0) return true;
        if ((top + bH + m) > wH || (left + bW + m) > wW) return true;

        return false;
    },

    openGame:function (){
        if(this._hidden){
            this._hidden = false;
            // Click counting is now handled in Agent._onClick
            this.show();
            var c = this._content;
            c.height(500);
            c.width(500);
            c.height(c.height());
            c.width(c.width());
            this.reposition();
        }else{
            this._hidden = true;
            this.hide(this._hidden);
        }
        this._complete = true;
    },


    speak:function (complete, text, hold) {
        this._hidden = false;
        this.show();
        var c = this._content;
        c.height('auto');
        c.width('auto');
        c.text(text);
        c.height(c.height());
        c.width(c.width());
        c.text('');
        this.reposition();

        this._complete = complete;
        this._sayWords(text, hold, complete);
    },

    show:function () {
        if (this._hidden) return;
        this._balloon.show();
    },

    hide:function (fast) {
        if (fast) {
            this._balloon.hide();
            return;
        }

        this._hiding = window.setTimeout($.proxy(this._finishHideBalloon, this), this.CLOSE_BALLOON_DELAY);
    },

    _finishHideBalloon:function () {
        if (this._active) return;
        this._balloon.hide();
        this._hidden = true;
        this._hiding = null;
    },

    _sayWords:function (text, hold, complete) {
        this._active = true;
        this._hold = hold;
        var words = text.split(/[^\S-]/);
        var time = this.WORD_SPEAK_TIME;
        var el = this._content;
        var idx = 1;


        this._addWord = $.proxy(function () {
            if (!this._active) return;
            if (idx > words.length) {
                this._active = false;
                if (!this._hold) {
                    complete();
                    this.hide();
                }
            } else {
                el.text(words.slice(0, idx).join(' '));
                idx++;
                this._loop = window.setTimeout($.proxy(this._addWord, this), time);
            }
        }, this);

        this._addWord();

    },

    close:function () {
        if (this._active) {
            this._hold = false;
        } else if (this._hold) {
            this._complete();
        }
    },

    pause:function () {
        window.clearTimeout(this._loop);
        if (this._hiding) {
            window.clearTimeout(this._hiding);
            this._hiding = null;
        }
    },

    resume:function () {
        if (this._addWord)  this._addWord();
        this._hiding = window.setTimeout($.proxy(this._finishHideBalloon, this), this.CLOSE_BALLOON_DELAY);
    },


    calculateFriendXP:function(friendName, action){
        let user_id = getUserIDFromName(friendName);
        //FIXME: asynchronous calls could be an issue here.
        let xp = getUserXPFromBrowser(friendName);
        switch(action){
            case 'upvoted':
                if(xp>0){xp += Math.log(xp)/8} else{xp=50;}
                break;
            case 'commented':
                if(xp>0){xp += Math.log(xp)/2} else{xp=50;}
                break;
            case 'answer_accepted':
                if(xp>0){xp += Math.log(xp)} else{xp=50;}
                break;
        }
        this.updateFriendXP(xp, user_id);
    },

    /***
     * Updates user XP by making an asynchronous AJAX call to the updateUserXP endpoint
     * @param {Number} xp 
     * @param {Number} userId
     */
    updateFriendXP:function (xp, userId) {
        $.ajax({
            url: 'http://localhost:3000/updateUserXP',
            type: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({
                user_id: userId,
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
    },

};

// clippy.BASE_PATH = '//s3.amazonaws.com/clippy.js/Agents/';

clippy.BASE_PATH = "../huskie-companion/agents/";

clippy.load = function (name, successCb, failCb) {
    var path = clippy.BASE_PATH + name;

    var mapDfd = clippy.load._loadMap(path);
    var agentDfd = clippy.load._loadAgent(name, path);
    var soundsDfd = clippy.load._loadSounds(name, path);

    var data;
    agentDfd.done(function (d) {
        data = d;
    });

    var sounds;

    soundsDfd.done(function (d) {
        sounds = d;
    });

    // wrapper to the success callback
    var cb = function () {
        var a = new clippy.Agent(path, data,sounds, name);
        // Store agent instance globally for access from other scripts
        if (!window.clippyAgents) {
            window.clippyAgents = {};
        }
        window.clippyAgents[name] = a;
        successCb(a);
    };

    $.when(mapDfd, agentDfd, soundsDfd).done(cb).fail(failCb);
};

clippy.load._maps = {};
clippy.load._loadMap = function (path) {
    var dfd = clippy.load._maps[path];
    if (dfd) return dfd;

    // set dfd if not defined
    dfd = clippy.load._maps[path] = $.Deferred();

    var src = path + '/map.png';
    var img = new Image();

    img.onload = dfd.resolve;
    img.onerror = dfd.reject;

    // start loading the map;
    img.setAttribute('src', src);

    return dfd.promise();
};

clippy.load._sounds = {};

clippy.load._loadSounds = function (name, path) {
    var dfd = clippy.load._sounds[name];
    if (dfd) return dfd;

    // set dfd if not defined
    dfd = clippy.load._sounds[name] = $.Deferred();

    var audio = document.createElement('audio');
    var canPlayMp3 = !!audio.canPlayType && "" != audio.canPlayType('audio/mpeg');
    var canPlayOgg = !!audio.canPlayType && "" != audio.canPlayType('audio/ogg; codecs="vorbis"');

    if (!canPlayMp3 && !canPlayOgg) {
        dfd.resolve({});
    } else {
        var src = path + (canPlayMp3 ? '/sounds-mp3.js' : '/sounds-ogg.js');
        // load
        clippy.load._loadScript(src);
    }

    return dfd.promise()
};


clippy.load._data = {};
clippy.load._loadAgent = function (name, path) {
    var dfd = clippy.load._data[name];
    if (dfd) return dfd;

    dfd = clippy.load._getAgentDfd(name);

    var src = path + '/agent.js';

    clippy.load._loadScript(src);

    return dfd.promise();
};

clippy.load._loadScript = function (src) {
    var script = document.createElement('script');
    script.setAttribute('src', src);
    script.setAttribute('async', 'async');
    script.setAttribute('type', 'text/javascript');

    document.head.appendChild(script);
};

clippy.load._getAgentDfd = function (name) {
    var dfd = clippy.load._data[name];
    if (!dfd) {
        dfd = clippy.load._data[name] = $.Deferred();
    }
    return dfd;
};

clippy.ready = function (name, data) {
    var dfd = clippy.load._getAgentDfd(name);
    dfd.resolve(data);
};

clippy.soundsReady = function (name, data) {
    var dfd = clippy.load._sounds[name];
    if (!dfd) {
        dfd = clippy.load._sounds[name] = $.Deferred();
    }

    dfd.resolve(data);
};

/******
 * Tiny Queue
 *
 * @constructor
 */
clippy.Queue = function (onEmptyCallback) {
    this._queue = [];
    this._onEmptyCallback = onEmptyCallback;
};

clippy.Queue.prototype = {
    /***
     *
     * @param {function(Function)} func
     * @returns {jQuery.Deferred}
     */
    queue:function (func) {
        this._queue.push(func);

        if (this._queue.length === 1 && !this._active) {
            this._progressQueue();
        }
    },

    _progressQueue:function () {

        // stop if nothing left in queue
        if (!this._queue.length) {
            this._onEmptyCallback();
            return;
        }

        var f = this._queue.shift();
        this._active = true;

        // execute function
        var completeFunction = $.proxy(this.next, this);
        f(completeFunction);
    },

    clear:function () {
        this._queue = [];
    },

    next:function () {
        this._active = false;
        this._progressQueue();
    }
};



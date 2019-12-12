import cn from "classnames";
import { Localized } from "fluent-react/compat";
import React, { FunctionComponent, useCallback, useEffect } from "react";
import { graphql } from "react-relay";

import { useViewerEvent } from "coral-framework/lib/events";
import { useLocal, withFragmentContainer } from "coral-framework/lib/relay";
import { GQLUSER_STATUS } from "coral-framework/schema";
import CLASSES from "coral-stream/classes";
import Counter from "coral-stream/common/Counter";
import { UserBoxContainer } from "coral-stream/common/UserBox";
import {
  SetCommentsOrderByEvent,
  SetCommentsTabEvent,
} from "coral-stream/events";
import {
  Flex,
  HorizontalGutter,
  Tab,
  TabBar,
  TabContent,
  TabPane,
} from "coral-ui/components";
import { PropTypesOf } from "coral-ui/types";

import { StreamContainer_settings as SettingsData } from "coral-stream/__generated__/StreamContainer_settings.graphql";
import { StreamContainer_story as StoryData } from "coral-stream/__generated__/StreamContainer_story.graphql";
import { StreamContainer_viewer as ViewerData } from "coral-stream/__generated__/StreamContainer_viewer.graphql";
import {
  COMMENTS_TAB,
  StreamContainerLocal,
} from "coral-stream/__generated__/StreamContainerLocal.graphql";

import AllCommentsTab from "./AllCommentsTab";
import BannedInfo from "./BannedInfo";
import { CommunityGuidelinesContainer } from "./CommunityGuidelines";
import StreamDeletionRequestCalloutContainer from "./DeleteAccount/StreamDeletionRequestCalloutContainer";
import FeaturedComments from "./FeaturedComments";
import FeaturedCommentTooltip from "./FeaturedCommentTooltip";
import { PostCommentFormContainer } from "./PostCommentForm";
import SortMenu from "./SortMenu";
import StoryClosedTimeoutContainer from "./StoryClosedTimeout";
import { SuspendedInfoContainer } from "./SuspendedInfo/index";
import useCommentCountEvent from "./useCommentCountEvent";

import styles from "./StreamContainer.css";

interface Props {
  story: StoryData;
  settings: SettingsData;
  viewer: ViewerData | null;
}

// Use a custom tab for featured comments, because we need to put the tooltip
// button logically next to the tab as both are buttons and position them together
// using absolute positioning.
const TabWithFeaturedTooltip: FunctionComponent<PropTypesOf<typeof Tab>> = ({
  ...props
}) => (
  <div className={styles.featuredCommentsTabContainer}>
    <Tab
      {...props}
      classes={{
        secondary: styles.featuredCommentsTabButton,
      }}
      className={cn(
        styles.fixedTab,
        CLASSES.tabBarComments.featured,
        styles.featuredCommentsTab
      )}
    />
    <FeaturedCommentTooltip
      active={props.active}
      className={cn(
        styles.featuredCommentsInfo,
        CLASSES.tabBarComments.featuredTooltip
      )}
    />
  </div>
);

export const StreamContainer: FunctionComponent<Props> = props => {
  const emitSetCommentsTabEvent = useViewerEvent(SetCommentsTabEvent);
  const emitSetCommentsOrderByEvent = useViewerEvent(SetCommentsOrderByEvent);
  const [local, setLocal] = useLocal<StreamContainerLocal>(
    graphql`
      fragment StreamContainerLocal on Local {
        commentsTab
        commentsOrderBy
      }
    `
  );
  const onChangeOrder = useCallback(
    (order: React.ChangeEvent<HTMLSelectElement>) => {
      if (local.commentsOrderBy === order.target.value) {
        return;
      }
      setLocal({ commentsOrderBy: order.target.value as any });
      emitSetCommentsOrderByEvent({ orderBy: order.target.value });
    },
    [setLocal, local.commentsOrderBy]
  );
  const onChangeTab = useCallback(
    (tab: COMMENTS_TAB, emit = true) => {
      if (local.commentsTab === tab) {
        return;
      }
      setLocal({ commentsTab: tab });
      if (emit) {
        emitSetCommentsTabEvent({ tab });
      }
    },
    [setLocal, local.commentsTab]
  );
  const banned = Boolean(
    props.viewer && props.viewer.status.current.includes(GQLUSER_STATUS.BANNED)
  );
  const suspended = Boolean(
    props.viewer &&
      props.viewer.status.current.includes(GQLUSER_STATUS.SUSPENDED)
  );

  const allCommentsCount = props.story.commentCounts.totalPublished;
  const featuredCommentsCount = props.story.commentCounts.tags.FEATURED;

  // Emit comment count event.
  useCommentCountEvent(props.story.id, props.story.url, allCommentsCount);

  useEffect(() => {
    // If the comment tab is still in its uninitialized state, "NONE", then we
    // should evaluate that based on the featuredCommentsCount if we should show
    // the featured comments tab first or not.
    if (local.commentsTab === "NONE") {
      // If the selected tab is FEATURED_COMMENTS, but there aren't any featured
      // comments, then switch it to the all comments tab.
      if (featuredCommentsCount === 0) {
        onChangeTab("ALL_COMMENTS", false);
      } else {
        onChangeTab("FEATURED_COMMENTS", false);
      }
    }
  }, [featuredCommentsCount, local.commentsTab, onChangeTab]);

  return (
    <>
      <StoryClosedTimeoutContainer story={props.story} />
      <HorizontalGutter
        className={cn(styles.root, {
          [CLASSES.commentsTabPane.authenticated]: Boolean(props.viewer),
          [CLASSES.commentsTabPane.unauthenticated]: !props.viewer,
        })}
        size="double"
      >
        <UserBoxContainer viewer={props.viewer} settings={props.settings} />
        {props.viewer && (
          <StreamDeletionRequestCalloutContainer viewer={props.viewer} />
        )}
        <CommunityGuidelinesContainer settings={props.settings} />
        {!banned && !suspended && (
          <PostCommentFormContainer
            settings={props.settings}
            story={props.story}
            viewer={props.viewer}
            tab={local.commentsTab}
            onChangeTab={onChangeTab}
            commentsOrderBy={local.commentsOrderBy}
          />
        )}
        {banned && <BannedInfo />}
        {suspended && (
          <SuspendedInfoContainer
            viewer={props.viewer}
            settings={props.settings}
          />
        )}
        <HorizontalGutter spacing={4} className={styles.tabBarContainer}>
          <Flex
            direction="row-reverse"
            alignItems="flex-end"
            justifyContent="space-between"
            className={styles.tabBarRow}
          >
            <SortMenu
              className={styles.sortMenu}
              orderBy={local.commentsOrderBy}
              onChange={onChangeOrder}
              reactionSortLabel={props.settings.reaction.sortLabel}
            />
            <TabBar
              variant="secondary"
              activeTab={local.commentsTab}
              onTabClick={onChangeTab}
              className={cn(CLASSES.tabBarComments.$root, styles.tabBarRoot)}
            >
              {featuredCommentsCount > 0 && (
                <TabWithFeaturedTooltip tabID="FEATURED_COMMENTS">
                  <Flex spacing={1} alignItems="center">
                    <Localized id="comments-featuredTab">
                      <span>Featured</span>
                    </Localized>
                    <Counter
                      data-testid="comments-featuredCount"
                      size="sm"
                      color={
                        local.commentsTab === "FEATURED_COMMENTS"
                          ? "primary"
                          : "grey"
                      }
                    >
                      {featuredCommentsCount}
                    </Counter>
                  </Flex>
                </TabWithFeaturedTooltip>
              )}
              <Tab
                tabID="ALL_COMMENTS"
                className={cn(
                  {
                    [styles.fixedTab]: featuredCommentsCount > 0,
                  },
                  CLASSES.tabBarComments.allComments
                )}
              >
                <Flex alignItems="center" spacing={1}>
                  <Localized id="comments-allCommentsTab">
                    <span>All Comments</span>
                  </Localized>
                  <Counter
                    size="sm"
                    color={
                      local.commentsTab === "ALL_COMMENTS" ? "primary" : "grey"
                    }
                  >
                    {allCommentsCount}
                  </Counter>
                </Flex>
              </Tab>
            </TabBar>
          </Flex>
          <TabContent activeTab={local.commentsTab}>
            <TabPane
              className={CLASSES.featuredCommentsTabPane.$root}
              tabID="FEATURED_COMMENTS"
            >
              <FeaturedComments />
            </TabPane>
            <TabPane
              className={CLASSES.allCommentsTabPane.$root}
              tabID="ALL_COMMENTS"
            >
              <AllCommentsTab />
            </TabPane>
          </TabContent>
        </HorizontalGutter>
      </HorizontalGutter>
    </>
  );
};

const enhanced = withFragmentContainer<Props>({
  story: graphql`
    fragment StreamContainer_story on Story {
      ...PostCommentFormContainer_story
      ...StoryClosedTimeoutContainer_story
      ...CreateCommentReplyMutation_story
      ...CreateCommentMutation_story
      id
      url
      commentCounts {
        totalPublished
        tags {
          FEATURED
        }
      }
    }
  `,
  viewer: graphql`
    fragment StreamContainer_viewer on User {
      ...UserBoxContainer_viewer
      ...CreateCommentReplyMutation_viewer
      ...CreateCommentMutation_viewer
      ...PostCommentFormContainer_viewer
      ...SuspendedInfoContainer_viewer
      ...StreamDeletionRequestCalloutContainer_viewer
      status {
        current
      }
    }
  `,
  settings: graphql`
    fragment StreamContainer_settings on Settings {
      reaction {
        sortLabel
      }
      ...PostCommentFormContainer_settings
      ...UserBoxContainer_settings
      ...CommunityGuidelinesContainer_settings
      ...SuspendedInfoContainer_settings
    }
  `,
})(StreamContainer);

export default enhanced;
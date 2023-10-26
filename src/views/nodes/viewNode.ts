import type { Command, Event, TreeViewVisibilityChangeEvent } from 'vscode';
import { Disposable, MarkdownString, TreeItem, TreeItemCollapsibleState } from 'vscode';
import type {
	TreeViewFileNodeTypes,
	TreeViewNodeTypes,
	TreeViewRefFileNodeTypes,
	TreeViewRefNodeTypes,
	TreeViewSubscribableNodeTypes,
} from '../../constants';
import { GlyphChars } from '../../constants';
import type { RepositoriesChangeEvent } from '../../git/gitProviderService';
import type { GitUri } from '../../git/gitUri';
import { unknownGitUri } from '../../git/gitUri';
import type { GitBranch } from '../../git/models/branch';
import type { GitCommit } from '../../git/models/commit';
import type { GitContributor } from '../../git/models/contributor';
import type { GitFile } from '../../git/models/file';
import type { GitReference, GitRevisionReference } from '../../git/models/reference';
import { getReferenceLabel } from '../../git/models/reference';
import type { GitReflogRecord } from '../../git/models/reflog';
import { GitRemote } from '../../git/models/remote';
import type { RepositoryChangeEvent } from '../../git/models/repository';
import { Repository, RepositoryChange, RepositoryChangeComparisonMode } from '../../git/models/repository';
import type { GitTag } from '../../git/models/tag';
import type { GitWorktree } from '../../git/models/worktree';
import type { SubscriptionChangeEvent } from '../../plus/subscription/subscriptionService';
import type {
	CloudWorkspace,
	CloudWorkspaceRepositoryDescriptor,
	LocalWorkspace,
	LocalWorkspaceRepositoryDescriptor,
} from '../../plus/workspaces/models';
import { gate } from '../../system/decorators/gate';
import { debug, log, logName } from '../../system/decorators/log';
import { weakEvent } from '../../system/event';
import { is as isA, szudzikPairing } from '../../system/function';
import { getLoggableName } from '../../system/logger';
import { pad } from '../../system/string';
import type { View } from '../viewBase';
import { disposeChildren } from '../viewBase';
import type { BranchNode } from './branchNode';
import type { BranchTrackingStatus } from './branchTrackingStatusNode';
import type { CommitFileNode } from './commitFileNode';
import type { CommitNode } from './commitNode';
import type { CompareBranchNode } from './compareBranchNode';
import type { CompareResultsNode } from './compareResultsNode';
import type { FileRevisionAsCommitNode } from './fileRevisionAsCommitNode';
import type { FolderNode } from './folderNode';
import type { LineHistoryTrackerNode } from './lineHistoryTrackerNode';
import type { MergeConflictFileNode } from './mergeConflictFileNode';
import type { RepositoryNode } from './repositoryNode';
import type { ResultsCommitsNode } from './resultsCommitsNode';
import type { ResultsFileNode } from './resultsFileNode';
import type { StashFileNode } from './stashFileNode';
import type { StashNode } from './stashNode';
import type { StatusFileNode } from './statusFileNode';
import type { TagNode } from './tagNode';
import type { UncommittedFileNode } from './UncommittedFileNode';

export const enum ContextValues {
	ActiveFileHistory = 'gitlens:history:active:file',
	ActiveLineHistory = 'gitlens:history:active:line',
	AutolinkedItems = 'gitlens:autolinked:items',
	AutolinkedIssue = 'gitlens:autolinked:issue',
	AutolinkedItem = 'gitlens:autolinked:item',
	Branch = 'gitlens:branch',
	Branches = 'gitlens:branches',
	BranchStatusAheadOfUpstream = 'gitlens:status-branch:upstream:ahead',
	BranchStatusBehindUpstream = 'gitlens:status-branch:upstream:behind',
	BranchStatusNoUpstream = 'gitlens:status-branch:upstream:none',
	BranchStatusSameAsUpstream = 'gitlens:status-branch:upstream:same',
	BranchStatusFiles = 'gitlens:status-branch:files',
	Commit = 'gitlens:commit',
	Commits = 'gitlens:commits',
	Compare = 'gitlens:compare',
	CompareBranch = 'gitlens:compare:branch',
	ComparePicker = 'gitlens:compare:picker',
	ComparePickerWithRef = 'gitlens:compare:picker:ref',
	CompareResults = 'gitlens:compare:results',
	CompareResultsCommits = 'gitlens:compare:results:commits',
	Contributor = 'gitlens:contributor',
	Contributors = 'gitlens:contributors',
	DateMarker = 'gitlens:date-marker',
	File = 'gitlens:file',
	FileHistory = 'gitlens:history:file',
	Folder = 'gitlens:folder',
	LineHistory = 'gitlens:history:line',
	Merge = 'gitlens:merge',
	MergeConflictCurrentChanges = 'gitlens:merge-conflict:current',
	MergeConflictIncomingChanges = 'gitlens:merge-conflict:incoming',
	Message = 'gitlens:message',
	MessageSignIn = 'gitlens:message:signin',
	Pager = 'gitlens:pager',
	PullRequest = 'gitlens:pullrequest',
	Rebase = 'gitlens:rebase',
	Reflog = 'gitlens:reflog',
	ReflogRecord = 'gitlens:reflog-record',
	Remote = 'gitlens:remote',
	Remotes = 'gitlens:remotes',
	Repositories = 'gitlens:repositories',
	Repository = 'gitlens:repository',
	RepositoryFolder = 'gitlens:repo-folder',
	ResultsFile = 'gitlens:file:results',
	ResultsFiles = 'gitlens:results:files',
	SearchAndCompare = 'gitlens:searchAndCompare',
	SearchResults = 'gitlens:search:results',
	SearchResultsCommits = 'gitlens:search:results:commits',
	Stash = 'gitlens:stash',
	Stashes = 'gitlens:stashes',
	StatusFileCommits = 'gitlens:status:file:commits',
	StatusFiles = 'gitlens:status:files',
	StatusAheadOfUpstream = 'gitlens:status:upstream:ahead',
	StatusBehindUpstream = 'gitlens:status:upstream:behind',
	StatusNoUpstream = 'gitlens:status:upstream:none',
	StatusSameAsUpstream = 'gitlens:status:upstream:same',
	Tag = 'gitlens:tag',
	Tags = 'gitlens:tags',
	UncommittedFiles = 'gitlens:uncommitted:files',
	Workspace = 'gitlens:workspace',
	WorkspaceMissingRepository = 'gitlens:workspaceMissingRepository',
	Workspaces = 'gitlens:workspaces',
	Worktree = 'gitlens:worktree',
	Worktrees = 'gitlens:worktrees',
}

export interface AmbientContext {
	readonly autolinksId?: string;
	readonly branch?: GitBranch;
	readonly branchStatus?: BranchTrackingStatus;
	readonly branchStatusUpstreamType?: 'ahead' | 'behind' | 'same' | 'none';
	readonly commit?: GitCommit;
	readonly comparisonId?: string;
	readonly comparisonFiltered?: boolean;
	readonly contributor?: GitContributor;
	readonly file?: GitFile;
	readonly reflog?: GitReflogRecord;
	readonly remote?: GitRemote;
	readonly repository?: Repository;
	readonly root?: boolean;
	readonly searchId?: string;
	readonly status?: 'merging' | 'rebasing';
	readonly storedComparisonId?: string;
	readonly tag?: GitTag;
	readonly workspace?: CloudWorkspace | LocalWorkspace;
	readonly wsRepositoryDescriptor?: CloudWorkspaceRepositoryDescriptor | LocalWorkspaceRepositoryDescriptor;
	readonly worktree?: GitWorktree;
}

export function getViewNodeId(type: string, context: AmbientContext): string {
	let uniqueness = '';
	if (context.root) {
		uniqueness += '/root';
	}
	if (context.workspace != null) {
		uniqueness += `/ws/${context.workspace.id}`;
	}
	if (context.wsRepositoryDescriptor != null) {
		uniqueness += `/wsrepo/${context.wsRepositoryDescriptor.id}`;
	}
	if (context.repository != null) {
		uniqueness += `/repo/${context.repository.id}`;
	}
	if (context.worktree != null) {
		uniqueness += `/worktree/${context.worktree.uri.path}`;
	}
	if (context.remote != null) {
		uniqueness += `/remote/${context.remote.name}`;
	}
	if (context.tag != null) {
		uniqueness += `/tag/${context.tag.id}`;
	}
	if (context.branch != null) {
		uniqueness += `/branch/${context.branch.id}`;
	}
	if (context.branchStatus != null) {
		uniqueness += `/branch-status/${context.branchStatus.upstream ?? '-'}`;
	}
	if (context.branchStatusUpstreamType != null) {
		uniqueness += `/branch-status-direction/${context.branchStatusUpstreamType}`;
	}
	if (context.status != null) {
		uniqueness += `/status/${context.status}`;
	}
	if (context.reflog != null) {
		uniqueness += `/reflog/${context.reflog.sha}+${context.reflog.selector}+${context.reflog.command}+${
			context.reflog.commandArgs ?? ''
		}+${context.reflog.date.getTime()}`;
	}
	if (context.contributor != null) {
		uniqueness += `/contributor/${
			context.contributor.id ??
			`${context.contributor.username}+${context.contributor.email}+${context.contributor.name}`
		}`;
	}
	if (context.autolinksId != null) {
		uniqueness += `/autolinks/${context.autolinksId}`;
	}
	if (context.comparisonId != null) {
		uniqueness += `/comparison/${context.comparisonId}`;
	}
	if (context.searchId != null) {
		uniqueness += `/search/${context.searchId}`;
	}
	if (context.commit != null) {
		uniqueness += `/commit/${context.commit.sha}`;
	}
	if (context.file != null) {
		uniqueness += `/file/${context.file.path}+${context.file.status}`;
	}

	return `gitlens://viewnode/${type}${uniqueness}`;
}

@logName<ViewNode>((c, name) => `${name}${c.id != null ? `(${c.id})` : ''}`)
export abstract class ViewNode<
	Type extends TreeViewNodeTypes = TreeViewNodeTypes,
	TView extends View = View,
	State extends object = any,
> implements Disposable
{
	is<T extends keyof TreeViewNodesByType>(type: T): this is TreeViewNodesByType[T] {
		return this.type === (type as unknown as Type);
	}

	protected _uniqueId!: string;
	protected splatted = false;
	// NOTE: @eamodio uncomment to track node leaks
	// readonly uuid = uuid();

	constructor(
		public readonly type: Type,
		// public readonly id: string | undefined,
		uri: GitUri,
		public readonly view: TView,
		protected parent?: ViewNode,
	) {
		// NOTE: @eamodio uncomment to track node leaks
		// queueMicrotask(() => this.view.registerNode(this));
		this._uri = uri;
	}

	protected _disposed = false;
	@debug()
	dispose() {
		this._disposed = true;
		// NOTE: @eamodio uncomment to track node leaks
		// this.view.unregisterNode(this);
	}

	get id(): string | undefined {
		return this._uniqueId;
	}

	private _context: AmbientContext | undefined;
	protected get context(): AmbientContext {
		return this._context ?? this.parent?.context ?? {};
	}

	protected updateContext(context: AmbientContext, reset: boolean = false) {
		this._context = this.getNewContext(context, reset);
	}

	protected getNewContext(context: AmbientContext, reset: boolean = false) {
		return { ...(reset ? this.parent?.context : this.context), ...context };
	}

	toClipboard?(): string;

	toString(): string {
		const id = this.id;
		return `${getLoggableName(this)}${id != null ? `(${id})` : ''}`;
	}

	protected _uri: GitUri;
	get uri(): GitUri {
		return this._uri;
	}

	abstract getChildren(): ViewNode[] | Promise<ViewNode[]>;

	getParent(): ViewNode | undefined {
		// If this node's parent has been splatted (e.g. not shown itself, but its children are), then return its grandparent
		return this.parent?.splatted ? this.parent?.getParent() : this.parent;
	}

	abstract getTreeItem(): TreeItem | Promise<TreeItem>;

	resolveTreeItem?(item: TreeItem): TreeItem | Promise<TreeItem>;

	getCommand(): Command | undefined {
		return undefined;
	}

	refresh?(reset?: boolean): boolean | void | Promise<void> | Promise<boolean>;

	@gate<ViewNode['triggerChange']>((reset, force, avoidSelf) => `${reset}|${force}|${avoidSelf?.toString()}`)
	@debug()
	triggerChange(reset: boolean = false, force: boolean = false, avoidSelf?: ViewNode): Promise<void> {
		if (this._disposed) return Promise.resolve();

		// If this node has been splatted (e.g. not shown itself, but its children are), then delegate the change to its parent
		if (this.splatted && this.parent != null && this.parent !== avoidSelf) {
			return this.parent.triggerChange(reset, force);
		}

		return this.view.refreshNode(this, reset, force);
	}

	getSplattedChild?(): Promise<ViewNode | undefined>;

	deleteState<T extends StateKey<State> = StateKey<State>>(key?: T): void {
		if (this.id == null) {
			debugger;
			throw new Error('Id is required to delete state');
		}
		this.view.nodeState.deleteState(this.id, key as string);
	}

	getState<T extends StateKey<State> = StateKey<State>>(key: T): StateValue<State, T> | undefined {
		if (this.id == null) {
			debugger;
			throw new Error('Id is required to get state');
		}
		return this.view.nodeState.getState(this.id, key as string);
	}

	storeState<T extends StateKey<State> = StateKey<State>>(
		key: T,
		value: StateValue<State, T>,
		sticky?: boolean,
	): void {
		if (this.id == null) {
			debugger;
			throw new Error('Id is required to store state');
		}
		this.view.nodeState.storeState(this.id, key as string, value, sticky);
	}
}

type StateKey<T> = keyof T;
type StateValue<T, P extends StateKey<T>> = P extends keyof T ? T[P] : never;

export abstract class CacheableChildrenViewNode<
	Type extends TreeViewNodeTypes = TreeViewNodeTypes,
	TView extends View = View,
	TChild extends ViewNode = ViewNode,
	State extends object = any,
> extends ViewNode<Type, TView, State> {
	private _children: TChild[] | undefined;
	protected get children(): TChild[] | undefined {
		return this._children;
	}
	protected set children(value: TChild[] | undefined) {
		if (this._children === value) return;

		disposeChildren(this._children, value);
		this._children = value;
	}

	@debug()
	override dispose() {
		super.dispose();
		this.children = undefined;
	}

	@debug()
	override refresh(reset: boolean = false) {
		if (reset) {
			this.children = undefined;
		}
	}
}

export abstract class ViewFileNode<
	Type extends TreeViewFileNodeTypes = TreeViewFileNodeTypes,
	TView extends View = View,
	State extends object = any,
> extends ViewNode<Type, TView, State> {
	constructor(
		type: Type,
		uri: GitUri,
		view: TView,
		public override parent: ViewNode,
		public readonly file: GitFile,
	) {
		super(type, uri, view, parent);
	}

	get repoPath(): string {
		return this.uri.repoPath!;
	}

	override toString(): string {
		return `${super.toString()}:${this.file.path}`;
	}
}

export abstract class ViewRefNode<
	Type extends TreeViewRefNodeTypes = TreeViewRefNodeTypes,
	TView extends View = View,
	TReference extends GitReference = GitReference,
	State extends object = any,
> extends ViewNode<Type, TView, State> {
	constructor(
		type: Type,
		uri: GitUri,
		view: TView,
		protected override readonly parent: ViewNode,
	) {
		super(type, uri, view, parent);
	}

	abstract get ref(): TReference;

	get repoPath(): string {
		return this.uri.repoPath!;
	}

	override toString(): string {
		return `${super.toString()}:${getReferenceLabel(this.ref, false)}`;
	}
}

export abstract class ViewRefFileNode<
	Type extends TreeViewRefFileNodeTypes = TreeViewRefFileNodeTypes,
	TView extends View = View,
	State extends object = any,
> extends ViewFileNode<Type, TView, State> {
	abstract get ref(): GitRevisionReference;

	override toString(): string {
		return `${super.toString()}:${this.file.path}`;
	}
}

export interface PageableViewNode extends ViewNode {
	readonly id: string;
	limit?: number;
	readonly hasMore: boolean;
	loadMore(limit?: number | { until?: string | undefined }, context?: Record<string, unknown>): Promise<void>;
}

export function isPageableViewNode(node: ViewNode): node is ViewNode & PageableViewNode {
	return isA<ViewNode & PageableViewNode>(node, 'loadMore');
}

export abstract class SubscribeableViewNode<
	Type extends TreeViewSubscribableNodeTypes = TreeViewSubscribableNodeTypes,
	TView extends View = View,
	TChild extends ViewNode = ViewNode,
	State extends object = any,
> extends CacheableChildrenViewNode<Type, TView, TChild, State> {
	protected disposable: Disposable;
	protected subscription: Promise<Disposable | undefined> | undefined;

	protected loaded: boolean = false;

	constructor(type: Type, uri: GitUri, view: TView, parent?: ViewNode) {
		super(type, uri, view, parent);

		const disposables = [
			weakEvent(this.view.onDidChangeVisibility, this.onVisibilityChanged, this),
			// weak(this.view.onDidChangeNodeCollapsibleState, this.onNodeCollapsibleStateChanged, this),
		];

		if (canAutoRefreshView(this.view)) {
			disposables.push(weakEvent(this.view.onDidChangeAutoRefresh, this.onAutoRefreshChanged, this));
		}

		const getTreeItem = this.getTreeItem;
		this.getTreeItem = function (this: SubscribeableViewNode<Type, TView>) {
			this.loaded = true;
			void this.ensureSubscription();
			return getTreeItem.apply(this);
		};

		const getChildren = this.getChildren;
		this.getChildren = function (this: SubscribeableViewNode<Type, TView>) {
			this.loaded = true;
			void this.ensureSubscription();
			return getChildren.apply(this);
		};

		this.disposable = Disposable.from(...disposables);
	}

	@debug()
	override dispose() {
		super.dispose();
		void this.unsubscribe();

		this.disposable?.dispose();
	}

	@gate<ViewNode['triggerChange']>((reset, force) => `${reset}|${force}`)
	@debug()
	override async triggerChange(reset: boolean = false, force: boolean = false): Promise<void> {
		if (!this.loaded || this._disposed) return;

		if (reset && !this.view.visible) {
			this._pendingReset = reset;
		}
		await super.triggerChange(reset, force);
	}

	private _canSubscribe: boolean = true;
	protected get canSubscribe(): boolean {
		return this._canSubscribe && !this._disposed;
	}
	protected set canSubscribe(value: boolean) {
		if (this._canSubscribe === value) return;

		this._canSubscribe = value;

		void this.ensureSubscription();
		if (value) {
			void this.triggerChange();
		}
	}

	private _etag: number | undefined;
	protected abstract etag(): number;

	private _pendingReset: boolean = false;
	private get requiresResetOnVisible(): boolean {
		let reset = this._pendingReset;
		this._pendingReset = false;

		const etag = this.etag();
		if (etag !== this._etag) {
			this._etag = etag;
			reset = true;
		}

		return reset;
	}

	protected abstract subscribe(): Disposable | undefined | Promise<Disposable | undefined>;

	@debug()
	protected async unsubscribe(): Promise<void> {
		this._etag = this.etag();

		if (this.subscription != null) {
			const subscriptionPromise = this.subscription;
			this.subscription = undefined;

			(await subscriptionPromise)?.dispose();
		}
	}

	@debug()
	protected onAutoRefreshChanged() {
		this.onVisibilityChanged({ visible: this.view.visible });
	}

	// protected onParentCollapsibleStateChanged?(state: TreeItemCollapsibleState): void;
	// protected onCollapsibleStateChanged?(state: TreeItemCollapsibleState): void;
	// protected collapsibleState: TreeItemCollapsibleState | undefined;
	// protected onNodeCollapsibleStateChanged(e: TreeViewNodeCollapsibleStateChangeEvent<ViewNode>) {
	// 	if (e.element === this) {
	// 		this.collapsibleState = e.state;
	// 		if (this.onCollapsibleStateChanged !== undefined) {
	// 			this.onCollapsibleStateChanged(e.state);
	// 		}
	// 	} else if (e.element === this.parent) {
	// 		if (this.onParentCollapsibleStateChanged !== undefined) {
	// 			this.onParentCollapsibleStateChanged(e.state);
	// 		}
	// 	}
	// }

	@debug()
	protected onVisibilityChanged(e: TreeViewVisibilityChangeEvent) {
		void this.ensureSubscription();

		if (e.visible) {
			void this.triggerChange(this.requiresResetOnVisible);
		}
	}

	@gate()
	@debug()
	async ensureSubscription() {
		// We only need to subscribe if we are visible and if auto-refresh enabled (when supported)
		if (!this.canSubscribe || !this.view.visible || (canAutoRefreshView(this.view) && !this.view.autoRefresh)) {
			await this.unsubscribe();

			return;
		}

		// If we already have a subscription, just kick out
		if (this.subscription != null) return;

		this.subscription = Promise.resolve(this.subscribe());
		void (await this.subscription);
	}

	@gate()
	@debug()
	async resetSubscription() {
		await this.unsubscribe();
		await this.ensureSubscription();
	}
}

export abstract class RepositoryFolderNode<
	TView extends View = View,
	TChild extends ViewNode = ViewNode,
> extends SubscribeableViewNode<'repo-folder', TView> {
	protected override splatted = true;

	constructor(
		uri: GitUri,
		view: TView,
		protected override readonly parent: ViewNode,
		public readonly repo: Repository,
		splatted: boolean,
		private readonly options?: { showBranchAndLastFetched?: boolean },
	) {
		super('repo-folder', uri, view, parent);

		this.updateContext({ repository: this.repo });
		this._uniqueId = getViewNodeId(this.type, this.context);

		this.splatted = splatted;
	}

	private _child: TChild | undefined;
	protected get child(): TChild | undefined {
		return this._child;
	}
	protected set child(value: TChild | undefined) {
		if (this._child === value) return;

		this._child?.dispose();
		this._child = value;
	}

	@debug()
	override dispose() {
		super.dispose();
		this.child = undefined;
	}

	override get id(): string {
		return this._uniqueId;
	}

	override toClipboard(): string {
		return this.repo.path;
	}

	get repoPath(): string {
		return this.repo.path;
	}

	async getTreeItem(): Promise<TreeItem> {
		this.splatted = false;

		const branch = await this.repo.getBranch();
		const ahead = (branch?.state.ahead ?? 0) > 0;
		const behind = (branch?.state.behind ?? 0) > 0;

		const expand = ahead || behind || this.repo.starred || this.view.container.git.isRepositoryForEditor(this.repo);

		const item = new TreeItem(
			this.repo.formattedName ?? this.uri.repoPath ?? '',
			expand ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.Collapsed,
		);
		item.contextValue = `${ContextValues.RepositoryFolder}${this.repo.starred ? '+starred' : ''}`;
		if (ahead) {
			item.contextValue += '+ahead';
		}
		if (behind) {
			item.contextValue += '+behind';
		}
		if (this.view.type === 'commits' && this.view.state.filterCommits.get(this.repo.id)?.length) {
			item.contextValue += '+filtered';
		}

		if (branch != null && this.options?.showBranchAndLastFetched) {
			const lastFetched = (await this.repo.getLastFetched()) ?? 0;

			const status = branch.getTrackingStatus();
			item.description = `${status ? `${status}${pad(GlyphChars.Dot, 1, 1)}` : ''}${branch.name}${
				lastFetched
					? `${pad(GlyphChars.Dot, 1, 1)}Last fetched ${Repository.formatLastFetched(lastFetched)}`
					: ''
			}`;

			let providerName;
			if (branch.upstream != null) {
				const providers = GitRemote.getHighlanderProviders(
					await this.view.container.git.getRemotesWithProviders(branch.repoPath),
				);
				providerName = providers?.length ? providers[0].name : undefined;
			} else {
				const remote = await branch.getRemote();
				providerName = remote?.provider?.name;
			}

			item.tooltip = new MarkdownString(
				`${this.repo.formattedName ?? this.uri.repoPath ?? ''}${
					lastFetched
						? `${pad(GlyphChars.Dash, 2, 2)}Last fetched ${Repository.formatLastFetched(
								lastFetched,
								false,
						  )}`
						: ''
				}${this.repo.formattedName ? `\n${this.uri.repoPath}` : ''}\n\nCurrent branch $(git-branch) ${
					branch.name
				}${
					branch.upstream != null
						? ` is ${branch.getTrackingStatus({
								empty: branch.upstream.missing
									? `missing upstream $(git-branch) ${branch.upstream.name}`
									: `up to date with $(git-branch) ${branch.upstream.name}${
											providerName ? ` on ${providerName}` : ''
									  }`,
								expand: true,
								icons: true,
								separator: ', ',
								suffix: ` $(git-branch) ${branch.upstream.name}${
									providerName ? ` on ${providerName}` : ''
								}`,
						  })}`
						: `hasn't been published to ${providerName ?? 'a remote'}`
				}`,
				true,
			);
		} else {
			item.tooltip = `${
				this.repo.formattedName ? `${this.repo.formattedName}\n${this.uri.repoPath}` : this.uri.repoPath ?? ''
			}`;
		}

		return item;
	}

	override async getSplattedChild() {
		if (this.child == null) {
			await this.getChildren();
		}

		return this.child;
	}

	@gate()
	@debug()
	override async refresh(reset: boolean = false) {
		super.refresh(reset);
		await this.child?.triggerChange(reset, false, this);

		await this.ensureSubscription();
	}

	@log()
	async star() {
		await this.repo.star();
		// void this.parent!.triggerChange();
	}

	@log()
	async unstar() {
		await this.repo.unstar();
		// void this.parent!.triggerChange();
	}

	@debug()
	protected subscribe(): Disposable | Promise<Disposable> {
		return weakEvent(this.repo.onDidChange, this.onRepositoryChanged, this);
	}

	protected override etag(): number {
		return this.repo.etag;
	}

	protected abstract changed(e: RepositoryChangeEvent): boolean;

	@debug<RepositoryFolderNode['onRepositoryChanged']>({ args: { 0: e => e.toString() } })
	private onRepositoryChanged(e: RepositoryChangeEvent) {
		if (e.changed(RepositoryChange.Closed, RepositoryChangeComparisonMode.Any)) {
			this.dispose();
			void this.parent?.triggerChange(true);

			return;
		}

		if (
			e.changed(RepositoryChange.Opened, RepositoryChangeComparisonMode.Any) ||
			e.changed(RepositoryChange.Starred, RepositoryChangeComparisonMode.Any)
		) {
			void this.parent?.triggerChange(true);

			return;
		}

		if (this.changed(e)) {
			void (this.loaded ? this : this.parent ?? this).triggerChange(true);
		}
	}
}

export abstract class RepositoriesSubscribeableNode<
	TView extends View = View,
	TChild extends ViewNode = ViewNode,
> extends SubscribeableViewNode<'repositories', TView, TChild> {
	protected override splatted = true;

	constructor(view: TView) {
		super('repositories', unknownGitUri, view);
	}

	override async getSplattedChild() {
		if (this.children == null) {
			await this.getChildren();
		}

		return this.children?.length === 1 ? this.children[0] : undefined;
	}

	protected override etag(): number {
		return szudzikPairing(this.view.container.git.etag, this.view.container.subscription.etag);
	}

	@debug()
	protected subscribe(): Disposable | Promise<Disposable> {
		return Disposable.from(
			weakEvent(this.view.container.git.onDidChangeRepositories, this.onRepositoriesChanged, this),
			weakEvent(this.view.container.subscription.onDidChange, this.onSubscriptionChanged, this),
		);
	}

	private onRepositoriesChanged(_e: RepositoriesChangeEvent) {
		void this.triggerChange(true);
	}

	private onSubscriptionChanged(e: SubscriptionChangeEvent) {
		if (e.current.plan !== e.previous.plan) {
			void this.triggerChange(true);
		}
	}
}

interface AutoRefreshableView {
	autoRefresh: boolean;
	onDidChangeAutoRefresh: Event<void>;
}

export function canAutoRefreshView(view: View): view is View & AutoRefreshableView {
	return isA<View & AutoRefreshableView>(view, 'onDidChangeAutoRefresh');
}

export function canEditNode(node: ViewNode): node is ViewNode & { edit(): void | Promise<void> } {
	return typeof (node as ViewNode & { edit(): void | Promise<void> }).edit === 'function';
}

export function canGetNodeRepoPath(node?: ViewNode): node is ViewNode & { repoPath: string | undefined } {
	return node != null && 'repoPath' in node && typeof node.repoPath === 'string';
}

export function canViewDismissNode(view: View): view is View & { dismissNode(node: ViewNode): void } {
	return typeof (view as View & { dismissNode(node: ViewNode): void }).dismissNode === 'function';
}

export function getNodeRepoPath(node?: ViewNode): string | undefined {
	return canGetNodeRepoPath(node) ? node.repoPath : undefined;
}

type TreeViewNodesByType = {
	[T in TreeViewNodeTypes]: T extends 'branch'
		? BranchNode
		: T extends 'commit'
		? CommitNode
		: T extends 'commit-file'
		? CommitFileNode
		: T extends 'compare-branch'
		? CompareBranchNode
		: T extends 'compare-results'
		? CompareResultsNode
		: T extends 'conflict-file'
		? MergeConflictFileNode
		: T extends 'file-commit'
		? FileRevisionAsCommitNode
		: T extends 'folder'
		? FolderNode
		: T extends 'line-history-tracker'
		? LineHistoryTrackerNode
		: T extends 'repository'
		? RepositoryNode
		: T extends 'repo-folder'
		? RepositoryFolderNode
		: T extends 'results-commits'
		? ResultsCommitsNode
		: T extends 'results-file'
		? ResultsFileNode
		: T extends 'stash'
		? StashNode
		: T extends 'stash-file'
		? StashFileNode
		: T extends 'status-file'
		? StatusFileNode
		: T extends 'tag'
		? TagNode
		: T extends 'uncommitted-file'
		? UncommittedFileNode
		: ViewNode<T>;
};

export function isViewNode(node: unknown): node is ViewNode;
export function isViewNode<T extends keyof TreeViewNodesByType>(node: unknown, type: T): node is TreeViewNodesByType[T];
export function isViewNode<T extends keyof TreeViewNodesByType>(node: unknown, type?: T): node is ViewNode {
	if (node == null) return false;
	return node instanceof ViewNode ? type == null || node.type === type : false;
}

export function isViewFileNode(node: unknown): node is ViewFileNode {
	return node instanceof ViewFileNode;
}

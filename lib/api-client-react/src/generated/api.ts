ptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type RevokeQuotePublicLinkMutationResult = NonNullable<Awaited<ReturnType<typeof revokeQuotePublicLink>>>

    export type RevokeQuotePublicLinkMutationError = ErrorType<void>

    /**
 * @summary Revoke the public approval link for a quote (owner only)
 */
export const useRevokeQuotePublicLink = <TError = ErrorType<void>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof revokeQuotePublicLink>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof revokeQuotePublicLink>>,
        TError,
        {id: number},
        TContext
      > => {
      return useMutation(getRevokeQuotePublicLinkMutationOptions(options));
    }

export const getConvertQuoteToTaskUrl = (id: number,) => {




  return `/api/quotes/${id}/convert-to-task`
}

/**
 * @summary Schedule one task from an approved quote
 */
export const convertQuoteToTask = async (id: number,
    quoteTaskScheduleInput: QuoteTaskScheduleInput, options?: RequestInit): Promise<Task> => {

  return customFetch<Task>(getConvertQuoteToTaskUrl(id),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(quoteTaskScheduleInput)
  }
);}





export const getConvertQuoteToTaskMutationOptions = <TError = ErrorType<void>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof convertQuoteToTask>>, TError,{id: number;data: BodyType<QuoteTaskScheduleInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof convertQuoteToTask>>, TError,{id: number;data: BodyType<QuoteTaskScheduleInput>}, TContext> => {

const mutationKey = ['convertQuoteToTask'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof convertQuoteToTask>>, {id: number;data: BodyType<QuoteTaskScheduleInput>}> = (props) => {
          const {id,data} = props ?? {};

          return  convertQuoteToTask(id,data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type ConvertQuoteToTaskMutationResult = NonNullable<Awaited<ReturnType<typeof convertQuoteToTask>>>
    export type ConvertQuoteToTaskMutationBody = BodyType<QuoteTaskScheduleInput>
    export type ConvertQuoteToTaskMutationError = ErrorType<void>

    /**
 * @summary Schedule one task from an approved quote
 */
export const useConvertQuoteToTask = <TError = ErrorType<void>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof convertQuoteToTask>>, TError,{id: number;data: BodyType<QuoteTaskScheduleInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof convertQuoteToTask>>,
        TError,
        {id: number;data: BodyType<QuoteTaskScheduleInput>},
        TContext
      > => {
      return useMutation(getConvertQuoteToTaskMutationOptions(options));
    }

export const getGetPublicQuoteUrl = (token: string,) => {




  return `/api/public/quotes/${token}`
}

/**
 * @summary Get a quote by its public token (no authentication)
 */
export const getPublicQuote = async (token: string, options?: RequestInit): Promise<PublicQuote> => {

  return customFetch<PublicQuote>(getGetPublicQuoteUrl(token),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetPublicQuoteQueryKey = (token: string,) => {
    return [
    `/api/public/quotes/${token}`
    ] as const;
    }


export const getGetPublicQuoteQueryOptions = <TData = Awaited<ReturnType<typeof getPublicQuote>>, TError = ErrorType<void>>(token: string, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getPublicQuote>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetPublicQuoteQueryKey(token);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getPublicQuote>>> = ({ signal }) => getPublicQuote(token, { signal, ...requestOptions });





   return  { queryKey, queryFn, enabled: token !== null && token !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getPublicQuote>>, TError, TData> & { queryKey: QueryKey }
}

export type GetPublicQuoteQueryResult = NonNullable<Awaited<ReturnType<typeof getPublicQuote>>>
export type GetPublicQuoteQueryError = ErrorType<void>


/**
 * @summary Get a quote by its public token (no authentication)
 */

export function useGetPublicQuote<TData = Awaited<ReturnType<typeof getPublicQuote>>, TError = ErrorType<void>>(
 token: string, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getPublicQuote>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetPublicQuoteQueryOptions(token,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getRespondPublicQuoteUrl = (token: string,) => {




  return `/api/public/quotes/${token}/respond`
}

/**
 * @summary Approve or reject a quote via its public token (no authentication)
 */
export const respondPublicQuote = async (token: string,
    publicQuoteResponseInput: PublicQuoteResponseInput, options?: RequestInit): Promise<PublicQuote> => {

  return customFetch<PublicQuote>(getRespondPublicQuoteUrl(token),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(publicQuoteResponseInput)
  }
);}





export const getRespondPublicQuoteMutationOptions = <TError = ErrorType<void>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof respondPublicQuote>>, TError,{token: string;data: BodyType<PublicQuoteResponseInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof respondPublicQuote>>, TError,{token: string;data: BodyType<PublicQuoteResponseInput>}, TContext> => {

const mutationKey = ['respondPublicQuote'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof respondPublicQuote>>, {token: string;data: BodyType<PublicQuoteResponseInput>}> = (props) => {
          const {token,data} = props ?? {};

          return  respondPublicQuote(token,data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type RespondPublicQuoteMutationResult = NonNullable<Awaited<ReturnType<typeof respondPublicQuote>>>
    export type RespondPublicQuoteMutationBody = BodyType<PublicQuoteResponseInput>
    export type RespondPublicQuoteMutationError = ErrorType<void>

    /**
 * @summary Approve or reject a quote via its public token (no authentication)
 */
export const useRespondPublicQuote = <TError = ErrorType<void>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof respondPublicQuote>>, TError,{token: string;data: BodyType<PublicQuoteResponseInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof respondPublicQuote>>,
        TError,
        {token: string;data: BodyType<PublicQuoteResponseInput>},
        TContext
      > => {
      return useMutation(getRespondPublicQuoteMutationOptions(options));
    }

export const getGetMonthlyReportUrl = (params: GetMonthlyReportParams,) => {
  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }
  });

  const stringifiedParams = normalizedParams.toString();

  return stringifiedParams.length > 0 ? `/api/reports/monthly?${stringifiedParams}` : `/api/reports/monthly`
}

/**
 * @summary Monthly financial report for the current team
 */
export const getMonthlyReport = async (params: GetMonthlyReportParams, options?: RequestInit): Promise<MonthlyReport> => {

  return customFetch<MonthlyReport>(getGetMonthlyReportUrl(params),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetMonthlyReportQueryKey = (params?: GetMonthlyReportParams,) => {
    return [
    `/api/reports/monthly`, ...(params ? [params] : [])
    ] as const;
    }


export const getGetMonthlyReportQueryOptions = <TData = Awaited<ReturnType<typeof getMonthlyReport>>, TError = ErrorType<unknown>>(params: GetMonthlyReportParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getMonthlyReport>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetMonthlyReportQueryKey(params);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getMonthlyReport>>> = ({ signal }) => getMonthlyReport(params, { signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getMonthlyReport>>, TError, TData> & { queryKey: QueryKey }
}

export type GetMonthlyReportQueryResult = NonNullable<Awaited<ReturnType<typeof getMonthlyReport>>>
export type GetMonthlyReportQueryError = ErrorType<unknown>


/**
 * @summary Monthly financial report for the current team
 */

export function useGetMonthlyReport<TData = Awaited<ReturnType<typeof getMonthlyReport>>, TError = ErrorType<unknown>>(
 params: GetMonthlyReportParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getMonthlyReport>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetMonthlyReportQueryOptions(params,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getUpdateTeamMemberRoleUrl = (userId: string,) => {




  return `/api/team/members/${userId}`
}

/**
 * @summary Change a member's role in the active team (owner only)
 */
export const updateTeamMemberRole = async (userId: string,
    teamMemberRoleInput: TeamMemberRoleInput, options?: RequestInit): Promise<TeamWithMembers> => {

  return customFetch<TeamWithMembers>(getUpdateTeamMemberRoleUrl(userId),
  {
    ...options,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(teamMemberRoleInput)
  }
);}





export const getUpdateTeamMemberRoleMutationOptions = <TError = ErrorType<void>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateTeamMemberRole>>, TError,{userId: string;data: BodyType<TeamMemberRoleInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof updateTeamMemberRole>>, TError,{userId: string;data: BodyType<TeamMemberRoleInput>}, TContext> => {

const mutationKey = ['updateTeamMemberRole'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof updateTeamMemberRole>>, {userId: string;data: BodyType<TeamMemberRoleInput>}> = (props) => {
          const {userId,data} = props ?? {};

          return  updateTeamMemberRole(userId,data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type UpdateTeamMemberRoleMutationResult = NonNullable<Awaited<ReturnType<typeof updateTeamMemberRole>>>
    export type UpdateTeamMemberRoleMutationBody = BodyType<TeamMemberRoleInput>
    export type UpdateTeamMemberRoleMutationError = ErrorType<void>

    /**
 * @summary Change a member's role in the active team (owner only)
 */
export const useUpdateTeamMemberRole = <TError = ErrorType<void>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateTeamMemberRole>>, TError,{userId: string;data: BodyType<TeamMemberRoleInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof updateTeamMemberRole>>,
        TError,
        {userId: string;data: BodyType<TeamMemberRoleInput>},
        TContext
      > => {
      return useMutation(getUpdateTeamMemberRoleMutationOptions(options));
    }

export const getRemoveTeamMemberUrl = (userId: string,) => {




  return `/api/team/members/${userId}`
}

/**
 * @summary Remove a member from the active team (owner only)
 */
export const removeTeamMember = async (userId: string, options?: RequestInit): Promise<TeamWithMembers> => {

  return customFetch<TeamWithMembers>(getRemoveTeamMemberUrl(userId),
  {
    ...options,
    method: 'DELETE'


  }
);}





export const getRemoveTeamMemberMutationOptions = <TError = ErrorType<void>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof removeTeamMember>>, TError,{userId: string}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof removeTeamMember>>, TError,{userId: string}, TContext> => {

const mutationKey = ['removeTeamMember'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof removeTeamMember>>, {userId: string}> = (props) => {
          const {userId} = props ?? {};

          return  removeTeamMember(userId,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type RemoveTeamMemberMutationResult = NonNullable<Awaited<ReturnType<typeof removeTeamMember>>>

    export type RemoveTeamMemberMutationError = ErrorType<void>

    /**
 * @summary Remove a member from the active team (owner only)
 */
export const useRemoveTeamMember = <TError = ErrorType<void>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof removeTeamMember>>, TError,{userId: string}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof removeTeamMember>>,
        TError,
        {userId: string},
        TContext
      > => {
      return useMutation(getRemoveTeamMemberMutationOptions(options));
    }

export const getListTasksUrl = (params?: ListTasksParams,) => {
  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }
  });

  const stringifiedParams = normalizedParams.toString();

  return stringifiedParams.length > 0 ? `/api/tasks?${stringifiedParams}` : `/api/tasks`
}

/**
 * @summary List tasks for the current team
 */
export const listTasks = async (params?: ListTasksParams, options?: RequestInit): Promise<Task[]> => {

  return customFetch<Task[]>(getListTasksUrl(params),
  {
    ...options,
    method: 'GET'


  }
);}





export const getListTasksQueryKey = (params?: ListTasksParams,) => {
    return [
    `/api/tasks`, ...(params ? [params] : [])
    ] as const;
    }


export const getListTasksQueryOptions = <TData = Awaited<ReturnType<typeof listTasks>>, TError = ErrorType<unknown>>(params?: ListTasksParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listTasks>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getListTasksQueryKey(params);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof listTasks>>> = ({ signal }) => listTasks(params, { signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof listTasks>>, TError, TData> & { queryKey: QueryKey }
}

export type ListTasksQueryResult = NonNullable<Awaited<ReturnType<typeof listTasks>>>
export type ListTasksQueryError = ErrorType<unknown>


/**
 * @summary List tasks for the current team
 */

export function useListTasks<TData = Awaited<ReturnType<typeof listTasks>>, TError = ErrorType<unknown>>(
 params?: ListTasksParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listTasks>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getListTasksQueryOptions(params,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getCreateTaskUrl = () => {




  return `/api/tasks`
}

/**
 * @summary Create a task
 */
export const createTask = async (taskInput: TaskInput, options?: RequestInit): Promise<Task> => {

  return customFetch<Task>(getCreateTaskUrl(),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(taskInput)
  }
);}





export const getCreateTaskMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createTask>>, TError,{data: BodyType<TaskInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof createTask>>, TError,{data: BodyType<TaskInput>}, TContext> => {

const mutationKey = ['createTask'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof createTask>>, {data: BodyType<TaskInput>}> = (props) => {
          const {data} = props ?? {};

          return  createTask(data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type CreateTaskMutationResult = NonNullable<Awaited<ReturnType<typeof createTask>>>
    export type CreateTaskMutationBody = BodyType<TaskInput>
    export type CreateTaskMutationError = ErrorType<unknown>

    /**
 * @summary Create a task
 */
export const useCreateTask = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createTask>>, TError,{data: BodyType<TaskInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof createTask>>,
        TError,
        {data: BodyType<TaskInput>},
        TContext
      > => {
      return useMutation(getCreateTaskMutationOptions(options));
    }

export const getUpdateTaskUrl = (id: number,) => {




  return `/api/tasks/${id}`
}

/**
 * @summary Update a task (including marking it done)
 */
export const updateTask = async (id: number,
    taskUpdate: TaskUpdate, options?: RequestInit): Promise<Task> => {

  return customFetch<Task>(getUpdateTaskUrl(id),
  {
    ...options,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(taskUpdate)
  }
);}





export const getUpdateTaskMutationOptions = <TError = ErrorType<void>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateTask>>, TError,{id: number;data: BodyType<TaskUpdate>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof updateTask>>, TError,{id: number;data: BodyType<TaskUpdate>}, TContext> => {

const mutationKey = ['updateTask'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof updateTask>>, {id: number;data: BodyType<TaskUpdate>}> = (props) => {
          const {id,data} = props ?? {};

          return  updateTask(id,data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type UpdateTaskMutationResult = NonNullable<Awaited<ReturnType<typeof updateTask>>>
    export type UpdateTaskMutationBody = BodyType<TaskUpdate>
    export type UpdateTaskMutationError = ErrorType<void>

    /**
 * @summary Update a task (including marking it done)
 */
export const useUpdateTask = <TError = ErrorType<void>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateTask>>, TError,{id: number;data: BodyType<TaskUpdate>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof updateTask>>,
        TError,
        {id: number;data: BodyType<TaskUpdate>},
        TContext
      > => {
      return useMutation(getUpdateTaskMutationOptions(options));
    }

export const getDeleteTaskUrl = (id: number,) => {




  return `/api/tasks/${id}`
}

/**
 * @summary Delete a task
 */
export const deleteTask = async (id: number, options?: RequestInit): Promise<void> => {

  return customFetch<void>(getDeleteTaskUrl(id),
  {
    ...options,
    method: 'DELETE'


  }
);}





export const getDeleteTaskMutationOptions = <TError = ErrorType<void>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteTask>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof deleteTask>>, TError,{id: number}, TContext> => {

const mutationKey = ['deleteTask'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof deleteTask>>, {id: number}> = (props) => {
          const {id} = props ?? {};

          return  deleteTask(id,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type DeleteTaskMutationResult = NonNullable<Awaited<ReturnType<typeof deleteTask>>>

    export type DeleteTaskMutationError = ErrorType<void>

    /**
 * @summary Delete a task
 */
export const useDeleteTask = <TError = ErrorType<void>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteTask>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof deleteTask>>,
        TError,
        {id: number},
        TContext
      > => {
      return useMutation(getDeleteTaskMutationOptions(options));
    }

export const getCreateTaskFeedbackLinkUrl = (id: number,) => {




  return `/api/tasks/${id}/feedback-link`
}

/**
 * @summary Create or reopen the feedback link for a completed task
 */
export const createTaskFeedbackLink = async (id: number, options?: RequestInit): Promise<TaskFeedbackLink> => {

  return customFetch<TaskFeedbackLink>(getCreateTaskFeedbackLinkUrl(id),
  {
    ...options,
    method: 'POST'


  }
);}





export const getCreateTaskFeedbackLinkMutationOptions = <TError = ErrorType<void>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createTaskFeedbackLink>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof createTaskFeedbackLink>>, TError,{id: number}, TContext> => {

const mutationKey = ['createTaskFeedbackLink'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof createTaskFeedbackLink>>, {id: number}> = (props) => {
          const {id} = props ?? {};

          return  createTaskFeedbackLink(id,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type CreateTaskFeedbackLinkMutationResult = NonNullable<Awaited<ReturnType<typeof createTaskFeedbackLink>>>

    export type CreateTaskFeedbackLinkMutationError = ErrorType<void>

    /**
 * @summary Create or reopen the feedback link for a completed task
 */
export const useCreateTaskFeedbackLink = <TError = ErrorType<void>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createTaskFeedbackLink>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof createTaskFeedbackLink>>,
        TError,
        {id: number},
        TContext
      > => {
      return useMutation(getCreateTaskFeedbackLinkMutationOptions(options));
    }

export const getAddTaskPhotoUrl = (id: number,) => {




  return `/api/tasks/${id}/photos`
}

/**
 * @summary Attach an uploaded photo to a task
 */
export const addTaskPhoto = async (id: number,
    taskPhotoInput: TaskPhotoInput, options?: RequestInit): Promise<TaskPhoto> => {

  return customFetch<TaskPhoto>(getAddTaskPhotoUrl(id),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(taskPhotoInput)
  }
);}





export const getAddTaskPhotoMutationOptions = <TError = ErrorType<void>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof addTaskPhoto>>, TError,{id: number;data: BodyType<TaskPhotoInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof addTaskPhoto>>, TError,{id: number;data: BodyType<TaskPhotoInput>}, TContext> => {

const mutationKey = ['addTaskPhoto'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof addTaskPhoto>>, {id: number;data: BodyType<TaskPhotoInput>}> = (props) => {
          const {id,data} = props ?? {};

          return  addTaskPhoto(id,data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type AddTaskPhotoMutationResult = NonNullable<Awaited<ReturnType<typeof addTaskPhoto>>>
    export type AddTaskPhotoMutationBody = BodyType<TaskPhotoInput>
    export type AddTaskPhotoMutationError = ErrorType<void>

    /**
 * @summary Attach an uploaded photo to a task
 */
export const useAddTaskPhoto = <TError = ErrorType<void>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof addTaskPhoto>>, TError,{id: number;data: BodyType<TaskPhotoInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof addTaskPhoto>>,
        TError,
        {id: number;data: BodyType<TaskPhotoInput>},
        TContext
      > => {
      return useMutation(getAddTaskPhotoMutationOptions(options));
    }

export const getDeleteTaskPhotoUrl = (id: number,
    photoId: number,) => {




  return `/api/tasks/${id}/photos/${photoId}`
}

/**
 * @summary Remove a photo from a task
 */
export const deleteTaskPhoto = async (id: number,
    photoId: number, options?: RequestInit): Promise<void> => {

  return customFetch<void>(getDeleteTaskPhotoUrl(id,photoId),
  {
    ...options,
    method: 'DELETE'


  }
);}





export const getDeleteTaskPhotoMutationOptions = <TError = ErrorType<void>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteTaskPhoto>>, TError,{id: number;photoId: number}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof deleteTaskPhoto>>, TError,{id: number;photoId: number}, TContext> => {

const mutationKey = ['deleteTaskPhoto'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof deleteTaskPhoto>>, {id: number;photoId: number}> = (props) => {
          const {id,photoId} = props ?? {};

          return  deleteTaskPhoto(id,photoId,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type DeleteTaskPhotoMutationResult = NonNullable<Awaited<ReturnType<typeof deleteTaskPhoto>>>

    export type DeleteTaskPhotoMutationError = ErrorType<void>

    /**
 * @summary Remove a photo from a task
 */
export const useDeleteTaskPhoto = <TError = ErrorType<void>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteTaskPhoto>>, TError,{id: number;photoId: number}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof deleteTaskPhoto>>,
        TError,
        {id: number;photoId: number},
        TContext
      > => {
      return useMutation(getDeleteTaskPhotoMutationOptions(options));
    }

export const getGetNotificationsUrl = () => {




  return `/api/notifications`
}

/**
 * @summary Get task reminders and recent quote responses as notifications
 */
export const getNotifications = async ( options?: RequestInit): Promise<NotificationsResponse> => {

  return customFetch<NotificationsResponse>(getGetNotificationsUrl(),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetNotificationsQueryKey = () => {
    return [
    `/api/notifications`
    ] as const;
    }


export const getGetNotificationsQueryOptions = <TData = Awaited<ReturnType<typeof getNotifications>>, TError = ErrorType<unknown>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getNotifications>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetNotificationsQueryKey();



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getNotifications>>> = ({ signal }) => getNotifications({ signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getNotifications>>, TError, TData> & { queryKey: QueryKey }
}

export type GetNotificationsQueryResult = NonNullable<Awaited<ReturnType<typeof getNotifications>>>
export type GetNotificationsQueryError = ErrorType<unknown>


/**
 * @summary Get task reminders and recent quote responses as notifications
 */

export function useGetNotifications<TData = Awaited<ReturnType<typeof getNotifications>>, TError = ErrorType<unknown>>(
  options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getNotifications>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetNotificationsQueryOptions(options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getRegisterPushTokenUrl = () => {




  return `/api/push-tokens`
}

/**
 * @summary Register an Expo push token for the current user
 */
export const registerPushToken = async (pushTokenRegistration: PushTokenRegistration, options?: RequestInit): Promise<void> => {

  return customFetch<void>(getRegisterPushTokenUrl(),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(pushTokenRegistration)
  }
);}





export const getRegisterPushTokenMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof registerPushToken>>, TError,{data: BodyType<PushTokenRegistration>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof registerPushToken>>, TError,{data: BodyType<PushTokenRegistration>}, TContext> => {

const mutationKey = ['registerPushToken'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof registerPushToken>>, {data: BodyType<PushTokenRegistration>}> = (props) => {
          const {data} = props ?? {};

          return  registerPushToken(data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type RegisterPushTokenMutationResult = NonNullable<Awaited<ReturnType<typeof registerPushToken>>>
    export type RegisterPushTokenMutationBody = BodyType<PushTokenRegistration>
    export type RegisterPushTokenMutationError = ErrorType<unknown>

    /**
 * @summary Register an Expo push token for the current user
 */
export const useRegisterPushToken = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof registerPushToken>>, TError,{data: BodyType<PushTokenRegistration>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof registerPushToken>>,
        TError,
        {data: BodyType<PushTokenRegistration>},
        TContext
      > => {
      return useMutation(getRegisterPushTokenMutationOptions(options));
    }

export const getUnregisterPushTokenUrl = () => {




  return `/api/push-tokens`
}

/**
 * @summary Remove an Expo push token for the current user
 */
export const unregisterPushToken = async (pushTokenUnregister: PushTokenUnregister, options?: RequestInit): Promise<void> => {

  return customFetch<void>(getUnregisterPushTokenUrl(),
  {
    ...options,
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(pushTokenUnregister)
  }
);}





export const getUnregisterPushTokenMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof unregisterPushToken>>, TError,{data: BodyType<PushTokenUnregister>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof unregisterPushToken>>, TError,{data: BodyType<PushTokenUnregister>}, TContext> => {

const mutationKey = ['unregisterPushToken'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof unregisterPushToken>>, {data: BodyType<PushTokenUnregister>}> = (props) => {
          const {data} = props ?? {};

          return  unregisterPushToken(data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type UnregisterPushTokenMutationResult = NonNullable<Awaited<ReturnType<typeof unregisterPushToken>>>
    export type UnregisterPushTokenMutationBody = BodyType<PushTokenUnregister>
    export type UnregisterPushTokenMutationError = ErrorType<unknown>

    /**
 * @summary Remove an Expo push token for the current user
 */
export const useUnregisterPushToken = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof unregisterPushToken>>, TError,{data: BodyType<PushTokenUnregister>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof unregisterPushToken>>,
        TError,
        {data: BodyType<PushTokenUnregister>},
        TContext
      > => {
      return useMutation(getUnregisterPushTokenMutationOptions(options));
    }

export const getGetCompanyUrl = () => {




  return `/api/company`
}

/**
 * @summary Get the current team's company profile
 */
export const getCompany = async ( options?: RequestInit): Promise<Company> => {

  return customFetch<Company>(getGetCompanyUrl(),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetCompanyQueryKey = () => {
    return [
    `/api/company`
    ] as const;
    }


export const getGetCompanyQueryOptions = <TData = Awaited<ReturnType<typeof getCompany>>, TError = ErrorType<void>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getCompany>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetCompanyQueryKey();



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getCompany>>> = ({ signal }) => getCompany({ signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getCompany>>, TError, TData> & { queryKey: QueryKey }
}

export type GetCompanyQueryResult = NonNullable<Awaited<ReturnType<typeof getCompany>>>
export type GetCompanyQueryError = ErrorType<void>


/**
 * @summary Get the current team's company profile
 */

export function useGetCompany<TData = Awaited<ReturnType<typeof getCompany>>, TError = ErrorType<void>>(
  options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getCompany>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetCompanyQueryOptions(options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getUpdateCompanyUrl = () => {




  return `/api/company`
}

/**
 * @summary Update the current team's company profile
 */
export const updateCompany = async (companyUpdate: CompanyUpdate, options?: RequestInit): Promise<Company> => {

  return customFetch<Company>(getUpdateCompanyUrl(),
  {
    ...options,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(companyUpdate)
  }
);}





export const getUpdateCompanyMutationOptions = <TError = ErrorType<void>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateCompany>>, TError,{data: BodyType<CompanyUpdate>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof updateCompany>>, TError,{data: BodyType<CompanyUpdate>}, TContext> => {

const mutationKey = ['updateCompany'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof updateCompany>>, {data: BodyType<CompanyUpdate>}> = (props) => {
          const {data} = props ?? {};

          return  updateCompany(data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type UpdateCompanyMutationResult = NonNullable<Awaited<ReturnType<typeof updateCompany>>>
    export type UpdateCompanyMutationBody = BodyType<CompanyUpdate>
    export type UpdateCompanyMutationError = ErrorType<void>

    /**
 * @summary Update the current team's company profile
 */
export const useUpdateCompany = <TError = ErrorType<void>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateCompany>>, TError,{data: BodyType<CompanyUpdate>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof updateCompany>>,
        TError,
        {data: BodyType<CompanyUpdate>},
        TContext
      > => {
      return useMutation(getUpdateCompanyMutationOptions(options));
    }

export const getListCompanyDocumentsUrl = () => {




  return `/api/company/documents`
}

/**
 * @summary List documents saved for the current company
 */
export const listCompanyDocuments = async ( options?: RequestInit): Promise<CompanyDocument[]> => {

  return customFetch<CompanyDocument[]>(getListCompanyDocumentsUrl(),
  {
    ...options,
    method: 'GET'


  }
);}





export const getListCompanyDocumentsQueryKey = () => {
    return [
    `/api/company/documents`
    ] as const;
    }


export const getListCompanyDocumentsQueryOptions = <TData = Awaited<ReturnType<typeof listCompanyDocuments>>, TError = ErrorType<unknown>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listCompanyDocuments>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getListCompanyDocumentsQueryKey();



    const queryFn: QueryFunction<Awaited<ReturnType<typeof listCompanyDocuments>>> = ({ signal }) => listCompanyDocuments({ signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof listCompanyDocuments>>, TError, TData> & { queryKey: QueryKey }
}

export type ListCompanyDocumentsQueryResult = NonNullable<Awaited<ReturnType<typeof listCompanyDocuments>>>
export type ListCompanyDocumentsQueryError = ErrorType<unknown>


/**
 * @summary List documents saved for the current company
 */

export function useListCompanyDocuments<TData = Awaited<ReturnType<typeof listCompanyDocuments>>, TError = ErrorType<unknown>>(
  options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listCompanyDocuments>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getListCompanyDocumentsQueryOptions(options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getCreateCompanyDocumentUrl = () => {




  return `/api/company/documents`
}

/**
 * @summary Save metadata for an uploaded company document
 */
export const createCompanyDocument = async (companyDocumentInput: CompanyDocumentInput, options?: RequestInit): Promise<CompanyDocument> => {

  return customFetch<CompanyDocument>(getCreateCompanyDocumentUrl(),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(companyDocumentInput)
  }
);}





export const getCreateCompanyDocumentMutationOptions = <TError = ErrorType<void>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createCompanyDocument>>, TError,{data: BodyType<CompanyDocumentInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof createCompanyDocument>>, TError,{data: BodyType<CompanyDocumentInput>}, TContext> => {

const mutationKey = ['createCompanyDocument'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof createCompanyDocument>>, {data: BodyType<CompanyDocumentInput>}> = (props) => {
          const {data} = props ?? {};

          return  createCompanyDocument(data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type CreateCompanyDocumentMutationResult = NonNullable<Awaited<ReturnType<typeof createCompanyDocument>>>
    export type CreateCompanyDocumentMutationBody = BodyType<CompanyDocumentInput>
    export type CreateCompanyDocumentMutationError = ErrorType<void>

    /**
 * @summary Save metadata for an uploaded company document
 */
export const useCreateCompanyDocument = <TError = ErrorType<void>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createCompanyDocument>>, TError,{data: BodyType<CompanyDocumentInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof createCompanyDocument>>,
        TError,
        {data: BodyType<CompanyDocumentInput>},
        TContext
      > => {
      return useMutation(getCreateCompanyDocumentMutationOptions(options));
    }

export const getDeleteCompanyDocumentUrl = (id: number,) => {




  return `/api/company/documents/${id}`
}

/**
 * @summary Remove a saved company document
 */
export const deleteCompanyDocument = async (id: number, options?: RequestInit): Promise<void> => {

  return customFetch<void>(getDeleteCompanyDocumentUrl(id),
  {
    ...options,
    method: 'DELETE'


  }
);}





export const getDeleteCompanyDocumentMutationOptions = <TError = ErrorType<void>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteCompanyDocument>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof deleteCompanyDocument>>, TError,{id: number}, TContext> => {

const mutationKey = ['deleteCompanyDocument'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof deleteCompanyDocument>>, {id: number}> = (props) => {
          const {id} = props ?? {};

          return  deleteCompanyDocument(id,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type DeleteCompanyDocumentMutationResult = NonNullable<Awaited<ReturnType<typeof deleteCompanyDocument>>>

    export type DeleteCompanyDocumentMutationError = ErrorType<void>

    /**
 * @summary Remove a saved company document
 */
export const useDeleteCompanyDocument = <TError = ErrorType<void>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteCompanyDocument>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof deleteCompanyDocument>>,
        TError,
        {id: number},
        TContext
      > => {
      return useMutation(getDeleteCompanyDocumentMutationOptions(options));
    }

export const getGetPublicTaskFeedbackUrl = (token: string,) => {




  return `/api/public/feedback/${token}`
}

/**
 * @summary Get a public feedback form for a completed task
 */
export const getPublicTaskFeedback = async (token: string, options?: RequestInit): Promise<PublicTaskFeedback> => {

  return customFetch<PublicTaskFeedback>(getGetPublicTaskFeedbackUrl(token),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetPublicTaskFeedbackQueryKey = (token: string,) => {
    return [
    `/api/public/feedback/${token}`
    ] as const;
    }


export const getGetPublicTaskFeedbackQueryOptions = <TData = Awaited<ReturnType<typeof getPublicTaskFeedback>>, TError = ErrorType<void>>(token: string, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getPublicTaskFeedback>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetPublicTaskFeedbackQueryKey(token);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getPublicTaskFeedback>>> = ({ signal }) => getPublicTaskFeedback(token, { signal, ...requestOptions });





   return  { queryKey, queryFn, enabled: token !== null && token !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getPublicTaskFeedback>>, TError, TData> & { queryKey: QueryKey }
}

export type GetPublicTaskFeedbackQueryResult = NonNullable<Awaited<ReturnType<typeof getPublicTaskFeedback>>>
export type GetPublicTaskFeedbackQueryError = ErrorType<void>


/**
 * @summary Get a public feedback form for a completed task
 */

export function useGetPublicTaskFeedback<TData = Awaited<ReturnType<typeof getPublicTaskFeedback>>, TError = ErrorType<void>>(
 token: string, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getPublicTaskFeedback>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetPublicTaskFeedbackQueryOptions(token,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getRespondPublicTaskFeedbackUrl = (token: string,) => {




  return `/api/public/feedback/${token}`
}

/**
 * @summary Submit a public rating and comment for a completed task
 */
export const respondPublicTaskFeedback = async (token: string,
    publicTaskFeedbackInput: PublicTaskFeedbackInput, options?: RequestInit): Promise<PublicTaskFeedbackSubmission> => {

  return customFetch<PublicTaskFeedbackSubmission>(getRespondPublicTaskFeedbackUrl(token),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(publicTaskFeedbackInput)
  }
);}





export const getRespondPublicTaskFeedbackMutationOptions = <TError = ErrorType<void>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof respondPublicTaskFeedback>>, TError,{token: string;data: BodyType<PublicTaskFeedbackInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof respondPublicTaskFeedback>>, TError,{token: string;data: BodyType<PublicTaskFeedbackInput>}, TContext> => {

const mutationKey = ['respondPublicTaskFeedback'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof respondPublicTaskFeedback>>, {token: string;data: BodyType<PublicTaskFeedbackInput>}> = (props) => {
          const {token,data} = props ?? {};

          return  respondPublicTaskFeedback(token,data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type RespondPublicTaskFeedbackMutationResult = NonNullable<Awaited<ReturnType<typeof respondPublicTaskFeedback>>>
    export type RespondPublicTaskFeedbackMutationBody = BodyType<PublicTaskFeedbackInput>
    export type RespondPublicTaskFeedbackMutationError = ErrorType<void>

    /**
 * @summary Submit a public rating and comment for a completed task
 */
export const useRespondPublicTaskFeedback = <TError = ErrorType<void>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof respondPublicTaskFeedback>>, TError,{token: string;data: BodyType<PublicTaskFeedbackInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof respondPublicTaskFeedback>>,
        TError,
        {token: string;data: BodyType<PublicTaskFeedbackInput>},
        TContext
      > => {
      return useMutation(getRespondPublicTaskFeedbackMutationOptions(options));
    }

export const getRequestUploadUrlUrl = () => {




  return `/api/storage/uploads/request-url`
}

/**
 * Returns a presigned GCS URL for direct upload. The client sends JSON
 * metadata here, then uploads the file directly to the returned URL.
 * @summary Request a presigned URL for file upload
 */
export const requestUploadUrl = async (uploadUrlRequest: UploadUrlRequest, options?: RequestInit): Promise<UploadUrlResponse> => {

  return customFetch<UploadUrlResponse>(getRequestUploadUrlUrl(),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(uploadUrlRequest)
  }
);}





export const getRequestUploadUrlMutationOptions = <TError = ErrorType<ErrorEnvelope>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof requestUploadUrl>>, TError,{data: BodyType<UploadUrlRequest>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof requestUploadUrl>>, TError,{data: BodyType<UploadUrlRequest>}, TContext> => {

const mutationKey = ['requestUploadUrl'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof requestUploadUrl>>, {data: BodyType<UploadUrlRequest>}> = (props) => {
          const {data} = props ?? {};

          return  requestUploadUrl(data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type RequestUploadUrlMutationResult = NonNullable<Awaited<ReturnType<typeof requestUploadUrl>>>
    export type RequestUploadUrlMutationBody = BodyType<UploadUrlRequest>
    export type RequestUploadUrlMutationError = ErrorType<ErrorEnvelope>

    /**
 * @summary Request a presigned URL for file upload
 */
export const useRequestUploadUrl = <TError = ErrorType<ErrorEnvelope>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof requestUploadUrl>>, TError,{data: BodyType<UploadUrlRequest>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof requestUploadUrl>>,
        TError,
        {data: BodyType<UploadUrlRequest>},
        TContext
      > => {
      return useMutation(getRequestUploadUrlMutationOptions(options));
    }

export const getGetPublicObjectUrl = (filePath: string,) => {




  return `/api/storage/public-objects/${filePath}`
}

/**
 * Unconditionally public — no authentication or ACL checks.
 * Searches PUBLIC_OBJECT_SEARCH_PATHS for the given file path.
 * @summary Serve a public asset from PUBLIC_OBJECT_SEARCH_PATHS
 */
export const getPublicObject = async (filePath: string, options?: RequestInit): Promise<Blob> => {

  return customFetch<Blob>(getGetPublicObjectUrl(filePath),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetPublicObjectQueryKey = (filePath: string,) => {
    return [
    `/api/storage/public-objects/${filePath}`
    ] as const;
    }


export const getGetPublicObjectQueryOptions = <TData = Awaited<ReturnType<typeof getPublicObject>>, TError = ErrorType<ErrorEnvelope>>(filePath: string, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getPublicObject>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetPublicObjectQueryKey(filePath);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getPublicObject>>> = ({ signal }) => getPublicObject(filePath, { signal, ...requestOptions });





   return  { queryKey, queryFn, enabled: filePath !== null && filePath !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getPublicObject>>, TError, TData> & { queryKey: QueryKey }
}

export type GetPublicObjectQueryResult = NonNullable<Awaited<ReturnType<typeof getPublicObject>>>
export type GetPublicObjectQueryError = ErrorType<ErrorEnvelope>


/**
 * @summary Serve a public asset from PUBLIC_OBJECT_SEARCH_PATHS
 */

export function useGetPublicObject<TData = Awaited<ReturnType<typeof getPublicObject>>, TError = ErrorType<ErrorEnvelope>>(
 filePath: string, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getPublicObject>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetPublicObjectQueryOptions(filePath,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getGetStorageObjectUrl = (objectPath: string,) => {




  return `/api/storage/objects/${objectPath}`
}

/**
 * Serves object entities uploaded via presigned URLs. These can optionally
 * be protected with authentication or ACL checks based on the use case.
 * @summary Serve an object entity from PRIVATE_OBJECT_DIR
 */
export const getStorageObject = async (objectPath: string, options?: RequestInit): Promise<Blob> => {

  return customFetch<Blob>(getGetStorageObjectUrl(objectPath),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetStorageObjectQueryKey = (objectPath: string,) => {
    return [
    `/api/storage/objects/${objectPath}`
    ] as const;
    }


export const getGetStorageObjectQueryOptions = <TData = Awaited<ReturnType<typeof getStorageObject>>, TError = ErrorType<ErrorEnvelope>>(objectPath: string, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getStorageObject>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetStorageObjectQueryKey(objectPath);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getStorageObject>>> = ({ signal }) => getStorageObject(objectPath, { signal, ...requestOptions });





   return  { queryKey, queryFn, enabled: objectPath !== null && objectPath !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getStorageObject>>, TError, TData> & { queryKey: QueryKey }
}

export type GetStorageObjectQueryResult = NonNullable<Awaited<ReturnType<typeof getStorageObject>>>
export type GetStorageObjectQueryError = ErrorType<ErrorEnvelope>


/**
 * @summary Serve an object entity from PRIVATE_OBJECT_DIR
 */

export function useGetStorageObject<TData = Awaited<ReturnType<typeof getStorageObject>>, TError = ErrorType<ErrorEnvelope>>(
 objectPath: string, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getStorageObject>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetStorageObjectQueryOptions(objectPath,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}








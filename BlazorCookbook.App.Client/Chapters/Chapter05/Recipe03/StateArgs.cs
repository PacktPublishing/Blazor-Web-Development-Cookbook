namespace BlazorCookbook.App.Client.Chapters.Chapter05.Recipe03;

public abstract record StateArgs;
public record SuccessArgs : StateArgs;
public record FailureArgs : StateArgs;